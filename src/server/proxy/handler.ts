import { randomUUID } from "node:crypto"
import { isIP } from "node:net"
import type { ApiFailure } from "@gethired/contracts"
import { COMPANY_MULTIPART_MAX_BYTES } from "@gethired/contracts"
import type { ProxyConfig } from "./config"

const MAX_BODY_BYTES = 64 * 1024
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const inputHeaders = ["accept", "content-type", "content-encoding", "cookie", "origin", "x-csrf-token",
  "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest"]
const outputHeaders = ["content-type", "cache-control", "x-request-id", "x-content-type-options", "allow", "retry-after"]

class ProxyFailure extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message) }
}
const unavailable = () => new ProxyFailure(503, "SERVICE_UNAVAILABLE", "The service is temporarily unavailable. Try again later.")

async function readBytes(stream: ReadableStream<Uint8Array> | null, limit: number, signal: AbortSignal) {
  if (!stream) return new Uint8Array()
  const reader = stream.getReader()
  const abort = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener("abort", abort, { once: true })
  let length = 0
  const chunks: Uint8Array[] = []
  try {
    signal.throwIfAborted()
    while (true) {
      const { done, value } = await reader.read()
      signal.throwIfAborted()
      if (done) break
      length += value.byteLength
      if (length > limit) {
        void reader.cancel().catch(() => {})
        throw new ProxyFailure(413, "PAYLOAD_TOO_LARGE", "The request body exceeds the size limit.")
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    return bytes
  } finally {
    signal.removeEventListener("abort", abort)
    reader.releaseLock()
  }
}

export function createApiProxy(config: () => ProxyConfig | undefined, fetcher: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    try {
      const settings = config()
      if (!settings) throw unavailable()
      const incoming = new URL(request.url)
      const bodyLimit = incoming.pathname === "/api/admin/company-images" && request.method === "POST" ? COMPANY_MULTIPART_MAX_BYTES : MAX_BODY_BYTES
      if (!/^\/api(?:\/[a-zA-Z0-9._~-]+)*\/?$/.test(incoming.pathname))
        throw new ProxyFailure(404, "NOT_FOUND", "The requested resource was not found.")
      // Keep the binding's base path and the API's existing /api prefix.
      const target = new URL(incoming.pathname.slice(1), `${settings.apiOrigin}/`)
      target.search = incoming.search
      const headers = new Headers()
      // An allowlist strips browser-supplied gateway, client-IP, forwarding and hop headers.
      for (const name of inputHeaders) {
        const value = request.headers.get(name)
        if (value !== null) headers.set(name, value)
      }
      headers.set("x-gethired-gateway", settings.gatewaySecret)
      if (settings.trustedIpHeader) {
        const ip = request.headers.get(settings.trustedIpHeader)
        if (!ip || !isIP(ip)) throw unavailable()
        headers.set("x-gethired-client-ip", ip)
      } else if (settings.production) throw unavailable()
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), settings.timeoutMs)
      const signal = AbortSignal.any([request.signal, controller.signal])
      try {
        const length = request.headers.get("content-length")
        if (length && /^\d+$/.test(length) && Number(length) > bodyLimit) {
          void request.body?.cancel().catch(() => {})
          throw new ProxyFailure(413, "PAYLOAD_TOO_LARGE", "The request body exceeds the size limit.")
        }
        const bytes = await readBytes(request.body, bodyLimit, signal)
        const noBody = ["GET", "HEAD"].includes(request.method)
        if (noBody && bytes.length) throw new ProxyFailure(400, "VALIDATION_ERROR", "Check the highlighted fields.")
        const upstream = await fetcher(target, {
          method: request.method, headers,
          ...(noBody ? {} : { body: bytes }),
          cache: "no-store", redirect: "error", signal,
        })
        if (upstream.status < 200 || upstream.status >= 300 && upstream.status < 400 ||
          !upstream.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
          void upstream.body?.cancel().catch(() => {})
          throw unavailable()
        }
        const resultHeaders = new Headers()
        for (const name of outputHeaders) {
          const value = upstream.headers.get(name)
          if (value !== null) resultHeaders.set(name, value)
        }
        resultHeaders.set("Cache-Control", "private, no-store")
        resultHeaders.set("X-Content-Type-Options", "nosniff")
        for (const cookie of upstream.headers.getSetCookie()) resultHeaders.append("Set-Cookie", cookie)
        const location = upstream.headers.get("location")
        if (location) {
          if (!location.startsWith("/api/") || /[\\\r\n]/.test(location)) throw unavailable()
          resultHeaders.set("Location", location)
        }
        let body: Uint8Array
        try { body = await readBytes(upstream.body, MAX_RESPONSE_BYTES, signal) } catch { throw unavailable() }
        return new Response(request.method === "HEAD" ? null : new Uint8Array(body), { status: upstream.status, headers: resultHeaders })
      } finally { clearTimeout(timer) }
    } catch (error) {
      const safe = error instanceof ProxyFailure ? error : unavailable()
      const requestId = randomUUID()
      console.info(JSON.stringify({ event: "api.proxy.failed", requestId, route: "/api/[[...path]]",
        method: request.method, status: safe.status, errorCode: safe.code }))
      const body: ApiFailure = { error: { code: safe.code, message: safe.message }, requestId }
      const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store",
        "X-Request-ID": requestId, "X-Content-Type-Options": "nosniff" }
      return new Response(request.method === "HEAD" ? null : JSON.stringify(body), { status: safe.status, headers })
    }
  }
}
