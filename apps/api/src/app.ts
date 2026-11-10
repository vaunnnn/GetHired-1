import express from "express"
import { randomUUID, timingSafeEqual } from "node:crypto"
import { isIP } from "node:net"
import { createApiRoute } from "./api/route.js"
import { ApiError } from "./api/errors.js"
import { errorResponse } from "./api/responses.js"
import { getServerConfig } from "./config.js"
import { logRequest } from "./logging/request.js"
import { createRoutes } from "./routes.js"
import { CLIENT_IP_HEADER, GATEWAY_HEADER, type TransportConfig } from "./http/config.js"
import { readIncomingBody, sendWebResponse, incomingUploadStream } from "./http/transport.js"

export default function createApp(transport: TransportConfig) {
  const app = express()
  app.disable("x-powered-by")
  app.disable("etag")
  app.set("trust proxy", false)
  const routes = createRoutes()
  const missing = createApiRoute({ route: "/api/[[...path]]", access: { kind: "public" }, methods: {} })
  app.use(async (request, response) => {
    const started = performance.now()
    let route = "/api/[[...path]]"
    try {
      // Do not derive an upstream URL, protocol, or identity from forwarded headers.
      if (!request.originalUrl.startsWith("/") || request.originalUrl.startsWith("//"))
        throw new ApiError("NOT_FOUND")
      const url = new URL(request.originalUrl, "http://api.internal")
      const match = url.pathname.match(/^(\/api\/(?:admin\/companies|companies|me\/bookmarks))\/([^/]+)$/)
      const studentMatch = url.pathname.match(/^\/api\/admin\/students\/([^/]+)(\/invitations)?$/)
      const bankMatch = url.pathname.match(/^(\/api\/(?:admin\/categories|admin\/questions|categories))\/([^/]+)(\/questions|\/pipeline)?$/)
      const attemptMatch = url.pathname.match(/^\/api\/me\/interview-attempts\/([^/]+)(?:\/(complete)|\/answers\/([^/]+)(\/submit)?)?$/)
      const template = attemptMatch ? `/api/me/interview-attempts/[attemptId]${attemptMatch[2] ? "/complete" : attemptMatch[3] ? `/answers/[questionId]${attemptMatch[4] ?? ""}` : ""}` : bankMatch ? `${bankMatch[1]}/[id]${bankMatch[3] ?? ""}` : studentMatch ? `/api/admin/students/[studentId]${studentMatch[2] ?? ""}` : match ? `${match[1]}/[companyId]` : url.pathname
      const handler = routes.get(template) ?? missing
      if (routes.has(template)) route = template
      const isProbe = ["/api/health/live", "/api/health/ready"].includes(url.pathname) && request.method === "GET"
      if (!isProbe) {
        const provided = request.headers[GATEWAY_HEADER]
        if (typeof provided !== "string" || !/^[a-f0-9]{64}$/i.test(provided) ||
          !timingSafeEqual(Buffer.from(provided), Buffer.from(transport.gatewaySecret)))
          throw new ApiError("FORBIDDEN")
        const ip = request.headers[CLIENT_IP_HEADER]
        if (ip !== undefined && (typeof ip !== "string" || !isIP(ip)))
          throw new ApiError("FORBIDDEN")
      }
      // These methods are forbidden by the Web Request constructor.
      if (["TRACE", "TRACK", "CONNECT"].includes(request.method)) {
        if (!routes.has(template)) throw new ApiError("NOT_FOUND")
        throw new ApiError("METHOD_NOT_ALLOWED", { allow: handler.allowedMethods })
      }
      const headers = new Headers()
      for (const [name, value] of Object.entries(request.headers)) {
        if (name === GATEWAY_HEADER || value === undefined) continue
        for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item)
      }
      const supported = handler.allowedMethods.some((method) => method === request.method)
      const upload = supported && url.pathname === "/api/admin/company-images" && request.method === "POST"
      if (!supported) response.shouldKeepAlive = false
      const bytes = supported && !upload
        ? await readIncomingBody(request, response, getServerConfig().maxBodyBytes, transport.bodyTimeoutMs)
        : new Uint8Array()
      const noBody = ["GET", "HEAD"].includes(request.method)
      if (noBody && bytes.length) throw new ApiError("VALIDATION_ERROR")
      const webRequest = new Request(url, {
        method: request.method,
        headers,
        ...(noBody ? {} : upload ? { body: incomingUploadStream(request, response), duplex: "half" } : { body: bytes }),
      } as RequestInit)
      // Every exported dispatcher consults the actual request method, including OPTIONS/HEAD.
      const result = await handler.GET(webRequest, { params: Promise.resolve(attemptMatch ? { attemptId: attemptMatch[1], questionId: attemptMatch[3] } : bankMatch ? { id: bankMatch[2] } : studentMatch ? { studentId: studentMatch[1] } : match ? { companyId: match[2] } : {}) })
      if (upload && !request.readableEnded) {
        await webRequest.body?.cancel().catch(() => {})
      }
      await sendWebResponse(result, response)
    } catch (error) {
      const safeError = error instanceof ApiError ? error : new ApiError("INTERNAL_ERROR")
      const requestId = randomUUID()
      response.shouldKeepAlive = false
      let result = errorResponse(safeError, requestId)
      if (request.method === "HEAD") result = new Response(null, { status: result.status, headers: result.headers })
      if (!response.headersSent && !response.destroyed) await sendWebResponse(result, response)
      try { await logRequest({ requestId, route, method: request.method, status: safeError.status,
        durationMs: Math.round(performance.now() - started), errorCode: safeError.code }) } catch { /* Logs never determine access. */ }
    }
  })
  return app
}
