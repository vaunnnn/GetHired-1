import assert from "node:assert/strict"
import { test } from "node:test"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { createApiProxy } from "../src/server/proxy/handler"
import { readProxyConfig, type ProxyConfig } from "../src/server/proxy/config"

const config: ProxyConfig = {
  apiOrigin: "https://api.example", gatewaySecret: "cd".repeat(32),
  production: false, timeoutMs: 1000,
}
function json(data: unknown = {}, status = 200, initial: HeadersInit = {}) {
  const headers = new Headers(initial)
  headers.set("Content-Type", "application/json")
  headers.set("X-Request-ID", "upstream-id")
  return Response.json({ data, requestId: "upstream-id" }, { status, headers })
}
const fetcher = (handler: (request: Request) => Promise<Response> | Response): typeof fetch =>
  async (input, init) => handler(new Request(input, init))

test("only the image POST route permits bounded multipart bodies above the JSON limit", async () => {
  let calls = 0
  const handle = createApiProxy(() => config, fetcher(async request => {
    calls++
    assert.match(request.headers.get("content-type")!, /^multipart\/form-data; boundary=/)
    const form = await request.formData()
    assert.equal((form.get("file") as File).size, 100000)
    return json({ imageId: "test" }, 201)
  }))
  const request = (path: string, size = 100000) => {
    const body = new FormData(); body.append("file", new Blob([new Uint8Array(size)], { type: "image/png" }), "image.png")
    return new Request(`https://frontend.example${path}`, { method: "POST", body })
  }
  assert.equal((await handle(request("/api/admin/company-images"))).status, 201)
  assert.equal((await handle(request("/api/admin/companies"))).status, 413)
  assert.equal((await handle(request("/api/admin/company-images", 2 * 1024 * 1024 + 16384))).status, 413)
  assert.equal(calls, 1)
})

test("proxy preserves origin, CSRF, body, query and individual cookies while stripping forged headers", async () => {
  const handle = createApiProxy(() => config, fetcher(async (request) => {
    assert.equal(request.url, "https://api.example/api/auth/login?next=%2Fdashboard")
    assert.equal(request.headers.get("x-gethired-gateway"), config.gatewaySecret)
    assert.equal(request.headers.get("x-gethired-client-ip"), null)
    assert.equal(request.headers.get("x-forwarded-for"), null)
    assert.equal(request.headers.get("authorization"), null)
    assert.equal(request.headers.get("origin"), "https://frontend.example")
    assert.equal(request.headers.get("x-csrf-token"), "csrf")
    assert.equal(request.headers.get("cookie"), "browser=binding")
    assert.equal(await request.text(), '{"identifier":"student"}')
    const headers = new Headers({ "Cache-Control": "public", "Location": "/api/example/123" })
    for (const name of ["access", "refresh", "browser"]) headers.append("Set-Cookie", `__Host-gethired-${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`)
    return json({}, 201, headers)
  }))
  const response = await handle(new Request("https://frontend.example/api/auth/login?next=%2Fdashboard", {
    method: "POST", headers: { Origin: "https://frontend.example", Cookie: "browser=binding", "X-CSRF-Token": "csrf",
      "x-gethired-gateway": "attacker", "x-gethired-client-ip": "8.8.8.8", "X-Forwarded-For": "8.8.8.8", Authorization: "attacker" },
    body: '{"identifier":"student"}',
  }))
  assert.equal(response.status, 201)
  assert.equal(response.headers.getSetCookie().length, 3)
  assert.equal(response.headers.get("cache-control"), "private, no-store")
  assert.equal(response.headers.get("location"), "/api/example/123")
  assert.equal(response.headers.get("x-request-id"), (await response.json()).requestId)
})

test("missing and hostile origins are never replaced with the configured frontend origin", async () => {
  for (const origin of [undefined, "https://evil.invalid"]) {
    const handle = createApiProxy(() => config, fetcher((request) => {
      assert.equal(request.headers.get("origin"), origin ?? null)
      assert.equal(request.headers.get("sec-fetch-site"), "cross-site")
      return json({}, 403)
    }))
    const headers = new Headers({ "Sec-Fetch-Site": "cross-site" })
    if (origin) headers.set("Origin", origin)
    assert.equal((await handle(new Request("https://front.example/api/auth/login", { method: "POST", headers, body: "{}" }))).status, 403)
  }
})

test("only the configured ingress header supplies the validated client IP", async () => {
  let calls = 0
  const handle = createApiProxy(() => ({ ...config, production: true, trustedIpHeader: "x-ingress-client-ip" }), fetcher((request) => {
    calls++
    assert.equal(request.headers.get("x-gethired-client-ip"), "203.0.113.1")
    assert.equal(request.headers.get("x-ingress-client-ip"), null)
    return json()
  }))
  for (const value of [null, "8.8.8.8, 203.0.113.1", "invalid"]) {
    const headers = new Headers({ "x-gethired-client-ip": "8.8.8.8" })
    if (value) headers.set("x-ingress-client-ip", value)
    assert.equal((await handle(new Request("https://front.example/api/auth/me", { headers }))).status, 503)
  }
  assert.equal(calls, 0)
  assert.equal((await handle(new Request("https://front.example/api/auth/me", { headers: { "x-ingress-client-ip": "203.0.113.1", "x-gethired-client-ip": "8.8.8.8" } }))).status, 200)
  assert.equal(calls, 1)
})

test("proxy rejects path escapes, actual oversized bodies, and unconfigured upstream without forwarding", async () => {
  const handle = createApiProxy(() => config, fetcher(() => { throw new Error("Must not forward") }))
  for (const path of ["/api/%2F%2Fevil.invalid", "/api/%252e%252e/admin", "/other"]) {
    assert.equal((await handle(new Request(`https://front.example${path}`))).status, 404)
  }
  const large = await handle(new Request("https://front.example/api/auth/login", { method: "POST", body: "x".repeat(65537) }))
  assert.equal(large.status, 413)
  const absent = await createApiProxy(() => undefined)(new Request("https://front.example/api/auth/me"))
  assert.equal(absent.status, 503)
})

test("upstream failure, HTML, and redirects yield safe JSON without replaying mutations", async () => {
  for (const outcome of [() => { throw new Error("private upstream error") }, () => new Response("<html>failure</html>", { status: 502 }),
    () => new Response(null, { status: 302, headers: { Location: "https://evil.invalid" } })]) {
    let calls = 0
    const response = await createApiProxy(() => config, fetcher(() => { calls++; return outcome() }))(
      new Request("https://front.example/api/auth/login", { method: "POST", body: "{}" }))
    assert.equal(response.status, 503)
    const body = await response.json()
    assert.equal(body.error.code, "SERVICE_UNAVAILABLE")
    assert.equal(body.requestId, response.headers.get("x-request-id"))
    assert.equal(calls, 1)
    assert.doesNotMatch(JSON.stringify(body), /private upstream/)
  }
})

test("actual upstream redirect is not followed and a stalled response is aborted", async () => {
  let leaked = 0
  const server = createServer((request, response) => {
    if (request.url === "/api/redirect") { response.writeHead(302, { Location: "/api/target" }); response.end() }
    else if (request.url === "/api/target") { leaked++; response.end("unexpected") }
    // /api/stall deliberately stays open to exercise the real fetch deadline.
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  try {
    const settings = { ...config, apiOrigin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, timeoutMs: 100 }
    const proxy = createApiProxy(() => settings)
    for (const path of ["redirect", "stall"]) {
      assert.equal((await proxy(new Request(`https://front.example/api/${path}`))).status, 503)
    }
    assert.equal(leaked, 0)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

test("HEAD preserves upstream status and headers without response body", async () => {
  const response = await createApiProxy(() => config, fetcher(() => json({}, 405, { Allow: "GET" })))(
    new Request("https://front.example/api/auth/me", { method: "HEAD" }))
  assert.equal(response.status, 405)
  assert.equal(response.headers.get("allow"), "GET")
  assert.equal(await response.text(), "")
})

test("production proxy requires explicit upstream, secret and verified ingress settings", () => {
  assert.equal(readProxyConfig({}), undefined)
  const env = { API_BASE_URL: "https://api.example", API_GATEWAY_SECRET: config.gatewaySecret, NODE_ENV: "production", API_INGRESS_IP_HEADER: "x-ingress-client-ip" }
  assert.equal(readProxyConfig(env)?.apiOrigin, "https://api.example")
  for (const patch of [{ API_BASE_URL: "https://api.example/path" }, { API_BASE_URL: "https://user:secret@api.example" },
    { API_BASE_URL: "http://api.example" }, { API_GATEWAY_SECRET: "bad" }, { API_INGRESS_IP_HEADER: "" },
    { API_INGRESS_IP_HEADER: "x-gethired-client-ip" }]) assert.throws(() => readProxyConfig({ ...env, ...patch }))
})

test("service binding wins over the legacy origin and preserves its base path", async () => {
  const env = {
    API_SERVICE_URL: "http://api.internal/service/api/",
    API_BASE_URL: "https://old-api.example",
    API_GATEWAY_SECRET: config.gatewaySecret,
    NODE_ENV: "production",
    API_INGRESS_IP_HEADER: "x-ingress-client-ip",
  }
  const settings = readProxyConfig(env)!
  assert.equal(settings.apiOrigin, "http://api.internal/service/api")
  let called = false
  const proxy = createApiProxy(() => settings, (async (input, init) => {
    called = true
    assert.equal(String(input), "http://api.internal/service/api/api/auth/me?check=1")
    assert.equal(new Headers(init?.headers).get("x-gethired-gateway"), config.gatewaySecret)
    return json({})
  }) as typeof fetch)
  const response = await proxy(new Request("https://front.example/api/auth/me?check=1", {
    headers: { "x-ingress-client-ip": "192.0.2.1" },
  }))
  assert.equal(response.status, 200)
  assert.equal(called, true)
  for (const value of ["", "not-a-url", "ftp://api.internal", "https://user:secret@api.internal", "https://api.internal?token=secret"]) {
    assert.throws(() => readProxyConfig({ ...env, API_SERVICE_URL: value }))
  }
})
