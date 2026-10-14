import { createHmac } from "node:crypto"
import { isIP } from "node:net"
import { ApiError } from "../api/errors.js"
import type { ApiResult } from "../api/responses.js"
import type { AuthConfig } from "./config.js"
import { createBrowserSecurity } from "./cookies.js"
import { emptyInput, loginInput } from "./input.js"
import { createProvider, RefreshReplayError } from "./provider.js"
import type { AuthStore } from "./store.js"
import type { Identity, Principal, Session } from "./types.js"

export interface AuthDependencies {
  config: AuthConfig
  appOrigin: string
  store: AuthStore
  provider: ReturnType<typeof createProvider>
  verify: (token: string) => Promise<Identity>
}
export function createAuthService({
  config,
  appOrigin,
  store,
  provider,
  verify,
}: AuthDependencies) {
  const browser = createBrowserSecurity(config, appOrigin)
  const projection = (session: Session) => ({
    expiresAt: session.expiresAt.toISOString(),
    rememberMe: session.rememberMe,
  })
  const limitKey = (kind: string, value: string) =>
    `${kind}:${createHmac("sha256", Buffer.from(config.cookieSecret, "hex")).update(value).digest("hex")}`
  async function authenticate(request: Request): Promise<Principal> {
    const access = browser.read(request, browser.names.access)
    const binding = browser.binding(request)
    if (!access || !binding?.sessionId) throw new ApiError("UNAUTHENTICATED")
    const identity = await verify(access)
    return store.withSession(
      binding.sessionId,
      identity,
      false,
      async (principal) => principal,
    )
  }
  return {
    browser,
    authenticate,
    // For later business services: call only after successful work, never for polling/refresh.
    recordActivity: (principal: Principal) =>
      store.withSession(
        principal.session.id,
        principal.identity,
        true,
        async () => undefined,
      ),
    revokeAll: (accountId: string) => store.revokeAll(accountId),
    csrf(request: Request): ApiResult {
      if (
        request.headers.get("sec-fetch-site") === "cross-site" ||
        (request.headers.has("origin") &&
          request.headers.get("origin") !== appOrigin)
      )
        throw new ApiError("CSRF_FAILED")
      const headers = new Headers()
      const binding = browser.binding(request) ?? browser.issueBinding(headers)
      return { data: { csrfToken: browser.csrfToken(binding) }, headers }
    },
    async login(request: Request, body: unknown): Promise<ApiResult> {
      browser.assertMutation(request)
      const input = loginInput(body)
      const rawIp = config.trustedIpHeader
        ? request.headers.get(config.trustedIpHeader)
        : "development"
      // Never trust arbitrary forwarded chains. The deployment must replace this header.
      if (!rawIp || (config.trustedIpHeader && !isIP(rawIp)))
        throw new ApiError("SERVICE_UNAVAILABLE")
      await store.consumeLimit(limitKey("ip", rawIp), 30, 900)
      const resolved = await store.resolveIdentifier(input.identifier)
      const credentialVersion = resolved ? await store.credentialVersion(resolved) : null
      const key = limitKey(
        "identifier",
        (resolved ?? input.identifier).toLowerCase(),
      )
      await store.consumeLimit(key, 5, 900)
      // Unknown email requests still use the real provider password verifier.
      const email =
        resolved ??
        (input.identifier.includes("@")
          ? input.identifier
          : "unregistered@gethired.invalid")
      const tokens = await provider.login(email, input.password)
      let principal: Principal
      try {
        const identity = await verify(tokens.accessToken)
        if (
          !resolved || credentialVersion === null ||
          !tokens.emailVerified ||
          tokens.userId !== identity.userId
        )
          throw new ApiError("INVALID_CREDENTIALS")
        principal = await store.createSession(identity, input.rememberMe, credentialVersion)
      } catch (error) {
        // No application session is created for an unprovisioned or inactive account.
        try {
          await provider.logout(tokens.accessToken)
        } catch {
          /* No app authorization was granted. */
        }
        if (error instanceof ApiError && error.code === "SERVICE_UNAVAILABLE")
          throw error
        throw new ApiError("INVALID_CREDENTIALS")
      }
      const headers = new Headers()
      browser.setCredentials(
        headers,
        tokens.accessToken,
        tokens.refreshToken,
        principal.session,
      )
      browser.issueBinding(headers, principal.session)
      await store.refundLimit(key)
      return {
        data: { user: principal.user, session: projection(principal.session) },
        headers,
      }
    },
    me(principal: Principal): ApiResult {
      return {
        data: { user: principal.user, session: projection(principal.session) },
      }
    },
    async refresh(request: Request, body: unknown): Promise<ApiResult> {
      const binding = browser.assertMutation(request)
      emptyInput(body)
      const refreshToken = browser.read(request, browser.names.refresh)
      if (!binding.sessionId || !refreshToken)
        throw new ApiError("UNAUTHENTICATED")
      // A DB row lock serializes requests across processes, not just within one server.
      const result = await store.withSession(
        binding.sessionId,
        null,
        false,
        async (principal, revoke) => {
          try {
            const tokens = await provider.refresh(refreshToken)
            const identity = await verify(tokens.accessToken)
            if (
              identity.sessionId !== principal.session.id ||
              identity.userId !== principal.identity.userId ||
              tokens.userId !== identity.userId ||
              !tokens.emailVerified
            )
              throw new ApiError("UNAUTHENTICATED")
            if (
              principal.session.expiresAt.getTime() <= Date.now() ||
              principal.session.lastActivityAt.getTime() +
                (principal.session.rememberMe ? 7 * 86400000 : 1800000) <=
                Date.now()
            )
              throw new ApiError("SESSION_EXPIRED")
            const headers = new Headers()
            browser.setCredentials(
              headers,
              tokens.accessToken,
              tokens.refreshToken,
              principal.session,
            )
            return { data: { session: projection(principal.session) }, headers }
          } catch (error) {
            if (error instanceof RefreshReplayError) {
              await revoke()
              // Return the denial so the revocation commits; throw after the transaction.
              return new ApiError("SESSION_EXPIRED")
            }
            throw error
          }
        },
      )
      if (result instanceof ApiError) throw result
      return result
    },
    async logout(request: Request, body: unknown): Promise<ApiResult> {
      const binding = browser.assertMutation(request)
      emptyInput(body)
      if (binding.sessionId) {
        // Works with an expired/missing JWT; the signed browser binding fixes the target.
        await store.revokeSession(binding.sessionId)
        const access = browser.read(request, browser.names.access)
        if (access) {
          try {
            const identity = await verify(access)
            if (identity.sessionId === binding.sessionId) {
              await provider.logout(access)
              await store.completeCleanup(binding.sessionId)
            }
          } catch {
            /* Durable cleanup remains pending; local revocation already committed. */
          }
        }
      }
      const headers = new Headers()
      browser.clear(headers)
      return { data: { loggedOut: true }, headers }
    },
  }
}
