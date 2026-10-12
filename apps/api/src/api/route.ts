import { randomUUID } from "node:crypto"
import { getServerConfig, type ServerConfig } from "../config.js"
import { logRequest, type RequestLogger } from "../logging/request.js"
import { parseBody, readLimitedBody, type BodyFormat } from "./body.js"
import { ApiError, type ApiErrorCode } from "./errors.js"
import { errorResponse, successResponse, type ApiResult } from "./responses.js"
import type { Principal } from "../auth/types.js"
import { assertPermission, isPermission, type Permission } from "../authorization/policy.js"

export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const
type HttpMethod = typeof HTTP_METHODS[number]
export type AccessPolicy = { kind: "public" } | {
  kind: "protected"
  permission: Permission
}
type Params = Record<string, string | string[] | undefined>
type RouteContext = { params: Promise<Params> }

export interface ApiContext {
  request: Request
  requestId: string
  params: Params
  body: unknown
  actor: { id: string; auth?: Principal } | null
}

interface Endpoint {
  body: BodyFormat
  /** Opt in only for user-driven business requests, never background polling. */
  activity?: "user"
  handle: (context: ApiContext) => ApiResult | Promise<ApiResult>
}

interface RouteDefinition {
  /** Static template, e.g. /api/companies/[companyId]; never a request URL. */
  route: string
  access: AccessPolicy
  methods: Partial<Record<HttpMethod, Endpoint>>
}

interface Dependencies {
  config?: () => ServerConfig
  logger?: RequestLogger
  enforceBrowserProtection?: (request: Request) => void | Promise<void>
  /** Later phases must verify identity, session, account state, and endpoint permission here. */
  enforceAccess?: (
    request: Request,
    policy: Extract<AccessPolicy, { kind: "protected" }>,
  ) => Promise<{ id: string; auth?: Principal }>
}

export function createApiRoute(
  definition: RouteDefinition,
  dependencies: Dependencies = {},
) {
  if (
    !definition.access ||
    !["public", "protected"].includes(definition.access.kind)
  ) {
    throw new Error("Every API route must declare its access policy.")
  }
  if (
    !definition.route.startsWith("/api") ||
    /[?\r\n#]/.test(definition.route)
  ) {
    throw new Error("API logging requires a static route template.")
  }
  if (definition.access.kind === "protected" && !isPermission(definition.access.permission))
    throw new Error("Protected routes require a known explicit permission.")
  const allow = HTTP_METHODS.filter((method) => definition.methods[method])
  if (allow.length && definition.access.kind === "public" &&
    /^\/api\/(?:admin|me|companies|categories)(?:\/|$)/.test(definition.route))
    throw new Error("Business routes require an explicit protected permission.")

  const dispatch = async (
    request: Request,
    routeContext?: RouteContext,
  ): Promise<Response> => {
    const requestId = randomUUID() // Never trust a caller-supplied correlation ID.
    const started = performance.now()
    let response: Response
    let actor: ApiContext["actor"] = null
    let errorCode: ApiErrorCode | undefined
    try {
      const config = (dependencies.config ?? getServerConfig)()
      const endpoint = HTTP_METHODS.includes(request.method as HttpMethod)
        ? definition.methods[(request.method as HttpMethod)]
        : undefined
      if (!endpoint) {
        throw allow.length
          ? new ApiError("METHOD_NOT_ALLOWED", { allow })
          : new ApiError("NOT_FOUND")
      }
      const bytes = await readLimitedBody(request, config.maxBodyBytes)
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
        if (dependencies.enforceBrowserProtection)
          await dependencies.enforceBrowserProtection(request)
        else {
          const { getAuthService } = await import("../auth/runtime.js")
          getAuthService().browser.assertMutation(request)
        }
      }
      if (definition.access.kind === "protected") {
        if (dependencies.enforceAccess)
          actor = await dependencies.enforceAccess(request, definition.access)
        else {
          const { getAuthService } = await import("../auth/runtime.js")
          const auth = await getAuthService().authenticate(request)
          actor = { id: auth.id, auth }
        }
        if (
          !actor ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            actor.id,
          )
        ) {
          actor = null
          throw new ApiError("SERVICE_UNAVAILABLE")
        }
        if (actor.auth) assertPermission(actor.auth, definition.access.permission)
      }
      const body = parseBody(request, bytes, endpoint.body)
      response = successResponse(
        await endpoint.handle({
          request,
          requestId,
          actor,
          body,
          params: routeContext ? await routeContext.params : {},
        }),
        requestId,
      )
      if (endpoint.activity === "user" && actor?.auth) {
        const { getAuthService } = await import("../auth/runtime.js")
        await getAuthService().recordActivity(actor.auth)
      }
    } catch (error) {
      const safeError =
        error instanceof ApiError ? error : new ApiError("INTERNAL_ERROR")
      errorCode = safeError.code
      response = errorResponse(safeError, requestId)
    }
    try {
      await (dependencies.logger ?? logRequest)({
        requestId,
        route: definition.route,
        method: HTTP_METHODS.includes(request.method as HttpMethod)
          ? request.method
          : "OTHER",
        status: response.status,
        durationMs: Math.round((performance.now() - started) * 100) / 100,
        ...(actor ? { actorId: actor.id } : {}),
        ...(errorCode ? { errorCode } : {}),
      })
    } catch {
      // Request-log availability must not change the response or bypass a denied request.
    }
    // HTTP forbids HEAD bodies; status and headers still follow the API contract.
    return request.method === "HEAD"
      ? new Response(null, {
          status: response.status,
          headers: response.headers,
        })
      : response
  }

  // The HTTP adapter uses this declaration before reading unsupported-method bodies.
  return {
    allowedMethods: allow,
    GET: dispatch,
    POST: dispatch,
    PUT: dispatch,
    PATCH: dispatch,
    DELETE: dispatch,
    HEAD: dispatch,
    OPTIONS: dispatch,
  }
}
