import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { createServer, request as httpRequest, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import createApp from "../src/app.js"
import { readTransportConfig } from "../src/http/config.js"
import { closeAuthService } from "../src/auth/runtime.js"

const gateway = "cd".repeat(32)
const origin = "https://gethired.example"
Object.assign(process.env, {
  NODE_ENV: "production", APP_ORIGIN: origin, API_GATEWAY_SECRET: gateway,
  AUTH_ENABLED: "true", SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test", SUPABASE_JWT_ALGORITHMS: "ES256",
  AUTH_COOKIE_SECRET: "ab".repeat(32), AUTH_TRUSTED_IP_HEADER: "x-gethired-client-ip",
  DATABASE_URL: "postgresql://app:example@localhost/postgres",
})
let server: Server
let base: string
before(async () => {
  server = createServer(createApp(readTransportConfig(process.env)))
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
after(async () => {
  await closeAuthService()
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

function call(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set("x-gethired-gateway", gateway)
  return fetch(`${base}${path}`, { ...options, headers })
}
async function expectError(response: Response, status: number, code: string) {
  assert.equal(response.status, status)
  assert.equal(response.headers.get("cache-control"), "private, no-store")
  const body = await response.json()
  assert.equal(body.error.code, code)
  assert.equal(body.requestId, response.headers.get("x-request-id"))
}
async function browser() {
  const response = await call("/api/auth/csrf")
  assert.equal(response.status, 200)
  const body = await response.json()
  const cookie = response.headers.getSetCookie()[0]
  assert.match(cookie, /^__Host-gethired-browser=/)
  assert.match(cookie, /HttpOnly; SameSite=Lax; Secure/)
  return { "Content-Type": "application/json", Origin: origin,
    Cookie: cookie.split(";")[0], "X-CSRF-Token": body.data.csrfToken }
}

test("only GET health probes bypass gateway authentication", async () => {
  assert.equal((await fetch(`${base}/api/health/live`)).status, 200)
  await expectError(await fetch(`${base}/api/health/ready`), 503, "SERVICE_UNAVAILABLE")
  await expectError(await fetch(`${base}/api/health/ready`, { method: "POST" }), 403, "FORBIDDEN")
  await expectError(await fetch(`${base}/api/auth/csrf`), 403, "FORBIDDEN")
  await expectError(await fetch(`${base}/api/health/live`, { method: "POST" }), 403, "FORBIDDEN")
  await expectError(await fetch(`${base}/api/auth/me`, { headers: {
    "x-gethired-gateway": "ff".repeat(32), "x-gethired-client-ip": "127.0.0.1", "x-role": "admin",
  } }), 403, "FORBIDDEN")
  await expectError(await call("/api/auth/me", { headers: { "x-gethired-client-ip": "127.0.0.1, 8.8.8.8" } }), 403, "FORBIDDEN")
})

test("B4 dynamic routes preserve method contracts and uploads require CSRF/session before parsing", async () => {
  const id = "00000000-0000-0000-0000-000000000000"
  await expectError(await call(`/api/companies/${id}`), 401, "UNAUTHENTICATED")
  const response = await call(`/api/admin/companies/${id}`, { method: "GET" })
  await expectError(response, 405, "METHOD_NOT_ALLOWED")
  assert.equal(response.headers.get("allow"), "PATCH")
  const body = new FormData(); body.append("file", new Blob([new Uint8Array(100000)], { type: "image/png" }), "test.png")
  await expectError(await call("/api/admin/company-images", { method: "POST", body }), 403, "CSRF_FAILED")
  const headers = new Headers(await browser()); headers.delete("content-type")
  await expectError(await call("/api/admin/company-images", { method: "POST", headers, body }), 401, "UNAUTHENTICATED")
})

test("real HTTP preserves cookie bootstrap, CSRF, validation and anonymous logout", async () => {
  const headers = await browser()
  await expectError(await call("/api/auth/me", { headers: { Cookie: "role=admin" } }), 401, "UNAUTHENTICATED")
  await expectError(await call("/api/auth/login", { method: "POST", body: "{}" }), 403, "CSRF_FAILED")
  await expectError(await call("/api/auth/login", { method: "POST", headers: { ...headers, Origin: "https://evil.invalid" }, body: "{}" }), 403, "CSRF_FAILED")
  await expectError(await call("/api/auth/login", { method: "POST", headers, body: "{" }), 400, "INVALID_JSON")
  await expectError(await call("/api/auth/login", { method: "POST", headers, body: "{}" }), 400, "VALIDATION_ERROR")
  await expectError(await call("/api/auth/login", { method: "POST", headers: { ...headers, "Content-Type": "text/plain" }, body: "{}" }), 415, "UNSUPPORTED_MEDIA_TYPE")
  await expectError(await call("/api/auth/refresh", { method: "POST", headers, body: "{}" }), 401, "UNAUTHENTICATED")
  const logout = await call("/api/auth/logout", { method: "POST", headers, body: "{}" })
  assert.equal(logout.status, 200)
  assert.deepEqual((await logout.json()).data, { loggedOut: true })
  assert.equal(logout.headers.getSetCookie().filter((cookie) => cookie.includes("Max-Age=0")).length, 3)
})

test("unknown routes and unsupported methods preserve JSON contracts", async () => {
  await expectError(await call("/api/unknown"), 404, "NOT_FOUND")
  const method = await call("/api/auth/login")
  assert.equal(method.headers.get("allow"), "POST")
  await expectError(method, 405, "METHOD_NOT_ALLOWED")
  await expectError(await call("/api/auth/me", { method: "OPTIONS" }), 405, "METHOD_NOT_ALLOWED")
  const head = await call("/api/auth/me", { method: "HEAD" })
  assert.equal(head.status, 405)
  assert.equal(await head.text(), "")
  // Method dispatch precedes body parsing, matching the original wrapper.
  await expectError(await call("/api/auth/me", { method: "POST", body: "x".repeat(65537) }), 405, "METHOD_NOT_ALLOWED")
})

test("oversized bodies return JSON 413 without resetting the socket", async () => {
  await expectError(await call("/api/auth/login", { method: "POST", body: "x".repeat(65537) }), 413, "PAYLOAD_TOO_LARGE")
  const result = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = httpRequest(`${base}/api/auth/login`, { method: "POST", headers: {
      "x-gethired-gateway": gateway, "Content-Type": "application/json", "Transfer-Encoding": "chunked",
    } }, (response) => {
      let body = ""
      response.on("data", (chunk) => { body += chunk })
      response.on("end", () => resolve({ status: response.statusCode!, body }))
    })
    req.on("error", reject)
    req.write("x".repeat(32768))
    req.end("x".repeat(32769))
  })
  assert.equal(result.status, 413)
  assert.equal(JSON.parse(result.body).error.code, "PAYLOAD_TOO_LARGE")
})

test("transport config rejects unsafe gateway and IP-header settings", () => {
  assert.throws(() => readTransportConfig({ API_GATEWAY_SECRET: "short" }))
  assert.throws(() => readTransportConfig({ API_GATEWAY_SECRET: gateway, PORT: "65536" }))
  assert.throws(() => readTransportConfig({ API_GATEWAY_SECRET: gateway, AUTH_TRUSTED_IP_HEADER: "x-forwarded-for" }))
})

test("B5 route templates dispatch explicitly and enforce CSRF/session before work", async () => {
  for (const path of ["signup", "signup/resend", "signup/verify", "invitations/accept", "password-reset/request", "password-reset/verify", "password-reset/complete"]) {
    const route = `/api/auth/${path}`
    const response = await call(route)
    assert.equal(response.headers.get("allow"), "POST")
    await expectError(response, 405, "METHOD_NOT_ALLOWED")
    await expectError(await call(route, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: "{}" }), 403, "CSRF_FAILED")
  }
  const headers = await browser(), id = "12345678-1234-1234-1234-123456789012"
  await expectError(await call("/api/admin/students"), 401, "UNAUTHENTICATED")
  await expectError(await call(`/api/admin/students/${id}`, { method: "PATCH", headers, body: "{}" }), 401, "UNAUTHENTICATED")
  await expectError(await call(`/api/admin/students/${id}/invitations`, { method: "POST", headers, body: "{}" }), 401, "UNAUTHENTICATED")
  await expectError(await call(`/api/admin/students/${id}`, { method: "DELETE", headers }), 405, "METHOD_NOT_ALLOWED")
})
