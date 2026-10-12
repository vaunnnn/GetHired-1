// Production Next.js + isolated HTTP contract fixture + headless Chrome.
// No Supabase account, real credentials, or external deployment is touched.
// Run after npm run build. Set CHROME_PATH when Chrome is elsewhere.
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { setTimeout as delay } from "node:timers/promises"

const children = [], sockets = []
const gateway = randomBytes(32).toString("hex")
const sessions = new Map()
let expired = false, outage = false, refreshes = 0, lastRemember
const users = {
  student: { id: randomUUID(), role: "student", displayName: "Browser Test Student", email: "21100123@usc.edu.ph",
    student: { studentNumber: "21100123", firstName: "Browser", lastName: "Student", course: "BSCS", yearLevel: "4" } },
  admin: { id: randomUUID(), role: "admin", displayName: "Browser Test Admin", email: "admin@example.test", student: null },
}
const fixture = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json")
  res.setHeader("Cache-Control", "private, no-store")
  const finish = (status, data, error) => { res.statusCode = status; res.end(JSON.stringify({ requestId: randomUUID(), ...(error ? { error: { code: error, message: error } } : { data }) })) }
  if (req.headers["x-gethired-gateway"] !== gateway) return finish(403, null, "FORBIDDEN")
  if (outage) return finish(503, null, "SERVICE_UNAVAILABLE")
  const id = /(?:^|;\s*)b3-test-session=([^;]+)/.exec(req.headers.cookie ?? "")?.[1]
  const role = sessions.get(id)
  const current = () => ({ user: users[role], session: { expiresAt: new Date(Date.now() + 3600000).toISOString(), rememberMe: false } })
  if (req.url === "/api/auth/csrf") return finish(200, { csrfToken: role ? "signed-in" : "anonymous" })
  if (req.method !== "GET" && req.headers["x-csrf-token"] !== (role ? "signed-in" : "anonymous")) return finish(403, null, "CSRF_FAILED")
  if (req.url === "/api/auth/me") return role && !expired ? finish(200, current()) : finish(401, null, "UNAUTHENTICATED")
  if (req.url === "/api/auth/login") {
    let raw = ""; for await (const chunk of req) raw += chunk
    const body = JSON.parse(raw)
    lastRemember = body.rememberMe
    if (body.password !== "test-only") return finish(401, null, "INVALID_CREDENTIALS")
    const nextRole = body.identifier === "admin@example.test" ? "admin" : "student"
    const nextId = randomUUID(); sessions.set(nextId, nextRole); expired = false
    res.setHeader("Set-Cookie", `b3-test-session=${nextId}; Path=/; HttpOnly; SameSite=Lax`)
    return finish(200, { user: users[nextRole], session: { expiresAt: new Date(Date.now() + 3600000).toISOString(), rememberMe: false } })
  }
  if (req.url === "/api/auth/refresh") {
    if (!role) return finish(401, null, "SESSION_EXPIRED")
    refreshes++; expired = false; return finish(200, { session: current().session })
  }
  if (req.url === "/api/auth/logout") {
    sessions.delete(id)
    res.setHeader("Set-Cookie", "b3-test-session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0")
    return finish(200, { loggedOut: true })
  }
  finish(404, null, "NOT_FOUND")
})

async function freePort() {
  const server = createServer(); server.listen(0, "127.0.0.1"); await once(server, "listening")
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port
}
function launch(command, args, env = process.env) {
  const child = spawn(command, args, { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
  child.stdout.resume(); child.stderr.resume(); children.push(child); return child
}
async function until(work, label) {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    try { if (await work()) return } catch { /* Wait for page or listener. */ }
    await delay(100)
  }
  throw new Error(`Timed out: ${label}`)
}
async function tab(debugPort) {
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json()
  const ws = new WebSocket(target.webSocketDebuggerUrl); sockets.push(ws); await once(ws, "open")
  let sequence = 0; const pending = new Map()
  ws.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data), task = pending.get(message.id)
    if (task) { pending.delete(message.id); message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result) }
  })
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }))
  })
  await call("Page.enable"); await call("Runtime.enable"); await call("Network.enable")
  await call("Network.setExtraHTTPHeaders", { headers: { "x-smoke-ingress-ip": "127.0.0.1" } })
  const evaluate = async expression => {
    const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }
  return { call, evaluate, navigate: url => call("Page.navigate", { url }) }
}

try {
  fixture.listen(0, "127.0.0.1"); await once(fixture, "listening")
  const port = await freePort(), debugPort = await freePort(), base = `http://127.0.0.1:${port}`
  const frontend = launch(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    ...process.env, NODE_ENV: "production", API_BASE_URL: `http://127.0.0.1:${fixture.address().port}`,
    API_GATEWAY_SECRET: gateway, API_ALLOW_PRIVATE_HTTP: "true", API_INGRESS_IP_HEADER: "x-smoke-ingress-ip",
  })
  await until(async () => { assert.equal(frontend.exitCode, null); return (await fetch(`${base}/login`)).ok }, "Next.js startup")
  const ingress = { "x-smoke-ingress-ip": "127.0.0.1" }
  const anonymous = await fetch(`${base}/admin`, { headers: { ...ingress, cookie: "role=admin; gethired_auth=admin" } })
  assert.match(anonymous.headers.get("cache-control"), /no-store/)
  assert.doesNotMatch(await anonymous.text(), /DCISM Student Registry/)

  const profile = await mkdtemp(join(tmpdir(), "gethired-b3-browser-"))
  launch(process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${debugPort}`, "--remote-debugging-address=127.0.0.1", `--user-data-dir=${profile}`, "about:blank"])
  await until(async () => (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok, "Chrome startup")
  const first = await tab(debugPort)
  await first.navigate(`${base}/login`)
  await until(() => first.evaluate("!!document.querySelector('#identifier')"), "login form")
  assert.equal(await first.evaluate("document.querySelector('[role=checkbox]').getAttribute('aria-checked')"), "false")
  await first.evaluate(`localStorage.setItem('gethired_auth', JSON.stringify({role:'admin'}))`)
  await first.navigate(`${base}/admin`)
  await until(() => first.evaluate("location.pathname === '/login' && !!document.querySelector('#identifier')"), "forged local storage denied")

  async function login(identifier, password = "test-only") {
    await first.evaluate(`(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      for (const [id, value] of ${JSON.stringify([["identifier", identifier], ["password", password]])}) {
        const input = document.getElementById(id); setter.call(input, value); input.dispatchEvent(new Event('input', {bubbles:true}));
      }
    })()`)
    await first.evaluate("document.querySelector('form').requestSubmit()")
  }
  await login("21100123", "wrong")
  await until(() => first.evaluate("document.querySelector('[role=alert]')?.textContent.includes('INVALID_CREDENTIALS')"), "invalid login shown")
  await login("21100123")
  await until(() => first.evaluate("location.pathname === '/dashboard' && document.body.innerText.includes('Welcome, Browser!') && !document.querySelector('[role=status]')"), "student login")
  assert.equal(lastRemember, false)
  const studentCookie = [...sessions.keys()][0]
  const wrongRole = await fetch(`${base}/admin`, { headers: { ...ingress, cookie: `b3-test-session=${studentCookie}` } })
  const denied = await wrongRole.text()
  assert.match(denied, /Access denied/); assert.doesNotMatch(denied, /DCISM Student Registry/)
  const second = await tab(debugPort)
  await second.navigate(`${base}/dashboard`)
  await until(() => second.evaluate("document.body.innerText.includes('Welcome, Browser!') && !document.querySelector('[role=status]')"), "second tab")
  expired = true
  // Both page GETs see expired access; browser recovery coordinates the refresh.
  await Promise.all([first.navigate(`${base}/dashboard`), second.navigate(`${base}/dashboard`)])
  await until(async () => (await Promise.all([first, second].map(t => t.evaluate("document.body.innerText.includes('Welcome, Browser!') && !document.querySelector('[role=status]')")))).every(Boolean), "cross-tab refresh")
  assert.equal(refreshes, 1)
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Log out').click()")
  await until(() => first.evaluate("location.pathname === '/login' && !!document.querySelector('#identifier')"), "logout")
  assert.equal(sessions.size, 0)
  await second.call("Page.bringToFront")
  await second.evaluate("window.dispatchEvent(new Event('focus'))")
  await until(() => second.evaluate("location.pathname === '/login'"), "other tab logout")
  await login("admin@example.test")
  await until(() => first.evaluate("location.pathname === '/admin' && document.body.innerText.includes('Browser Test Admin') && !document.querySelector('[role=status]')"), "admin login")
  outage = true
  await first.navigate(`${base}/admin`)
  await until(() => first.evaluate("document.body.innerText.includes('Unable to load your workspace')"), "outage view")
  assert.equal(await first.evaluate("location.pathname"), "/admin")
  outage = false
  await first.navigate(`${base}/signup`)
  await until(() => first.evaluate("document.body.innerText.includes('Registration is not available yet')"), "signup unavailable")
  console.log("B3 browser smoke passed: page protection, forged identity denial, invalid/valid login, live profile, role denial, cross-tab refresh, logout propagation, outage view, and unavailable signup.")
} finally {
  for (const ws of sockets) ws.close()
  for (const child of children.reverse()) if (child.exitCode === null) child.kill()
  fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve))
}
