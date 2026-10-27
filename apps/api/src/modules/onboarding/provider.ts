import { ApiError } from "../../api/errors.js"
import type { AuthConfig } from "../../auth/config.js"
import { UUID } from "../../auth/types.js"
import { decodeJwt } from "jose"
import type { SetupConfig } from "./security.js"

export type ProofType = "signup" | "invite" | "recovery"
export interface SetupSession { accessToken: string; refreshToken: string; userId: string; email: string; sessionId: string }
export function createSetupProvider(auth: AuthConfig, setup: SetupConfig, appOrigin: string, fetcher: typeof fetch = fetch) {
  async function call(path: string, body: object, admin = false, method = "POST") {
    let response: Response
    try {
      response = await fetcher(`${auth.supabaseUrl}/auth/v1/${path}`, { method,
        headers: { apikey: admin ? setup.adminKey : auth.publishableKey, "Content-Type": "application/json",
          ...(admin && setup.adminKey.startsWith("eyJ") ? { Authorization: `Bearer ${setup.adminKey}` } : {}) },
        body: JSON.stringify(body), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) })
    } catch { throw new ApiError("SERVICE_UNAVAILABLE") }
    if (response.status === 429) throw new ApiError("RATE_LIMITED", { retryAfter: 60 })
    if (!response.ok) {
      if (path === "verify" && [400, 401, 403, 422].includes(response.status)) throw new ApiError("INVALID_VERIFICATION_CODE")
      throw new ApiError("SERVICE_UNAVAILABLE")
    }
    try { return await response.json() } catch { throw new ApiError("SERVICE_UNAVAILABLE") }
  }
  return {
    async signup(email: string, password: string) {
      const data = await call("signup", { email, password })
      // Auto-confirm must be disabled. Never issue an ordinary app session here.
      if (data.access_token) throw new ApiError("SERVICE_UNAVAILABLE")
    },
    async send(email: string, type: ProofType, invitation = false) {
      if (type === "signup") await call("resend", { type: "signup", email })
      else if (type === "invite") await call(`invite?redirect_to=${encodeURIComponent(`${appOrigin}/invite`)}`, { email }, true)
      else await call(`recover?redirect_to=${encodeURIComponent(`${appOrigin}/${invitation ? "invite" : "password-reset"}`)}`, { email })
    },
    async verify(tokenHash: string, type: ProofType): Promise<SetupSession> {
      const data = await call("verify", { token_hash: tokenHash, type })
      if (typeof data.access_token !== "string" || typeof data.refresh_token !== "string" || !UUID.test(data.user?.id ?? "") ||
        typeof data.user?.email !== "string" || !data.user?.email_confirmed_at) throw new ApiError("SERVICE_UNAVAILABLE")
      let sessionId: string
      try {
        const claims = decodeJwt(data.access_token)
        if (claims.sub !== data.user.id || typeof claims.session_id !== "string" || !UUID.test(claims.session_id)) throw new Error()
        sessionId = claims.session_id
      } catch { throw new ApiError("SERVICE_UNAVAILABLE") }
      return { accessToken: data.access_token, refreshToken: data.refresh_token, userId: data.user.id, email: data.user.email.toLowerCase(), sessionId }
    },
    async end(accessToken: string) {
      try {
        const response = await fetcher(`${auth.supabaseUrl}/auth/v1/logout?scope=local`, { method: "POST",
          headers: { apikey: auth.publishableKey, Authorization: `Bearer ${accessToken}` },
          cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) })
        if (!response.ok) throw new Error()
      } catch { throw new ApiError("SERVICE_UNAVAILABLE") }
    },
    async password(userId: string, password: string) {
      if (!UUID.test(userId)) throw new ApiError("SERVICE_UNAVAILABLE")
      await call(`admin/users/${userId}`, { password }, true, "PUT")
    },
  }
}
