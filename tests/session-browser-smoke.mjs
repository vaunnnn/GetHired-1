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
import { browserTimingSource, summarizeNavigation } from "./performance-metrics.mjs"

const children = [], sockets = []
const gateway = randomBytes(32).toString("hex")
const sessions = new Map()
let expired = false, outage = false, refreshes = 0, lastRemember
let holdSessionCheck, sessionCheckHeld = false
let holdOldSearch, oldSearchHeld = false, holdSecondPage, secondPageHeld = false
const onboardingRequests = [], registry = new Map()
let invitations = 0
const companyId = randomUUID(), savedCompanies = new Set()
const categoryId = randomUUID(), questionId = randomUUID()
let category = { id: categoryId, name: "B6 Browser Track", description: "Browser practice", color: "#112233", bg: "#ffffff", status: "active", pipeline: "Intro", phases: [{ id: "intro", label: "Introduction", shortLabel: "Intro", types: ["Introduction"], count: 1 }] }
let bankQuestion = { id: questionId, question: "B6 introduce yourself", type: "Introduction", hint: "Be specific", feedback: "B6_PRIVATE_RUBRIC", status: "active" }
let company = { id: companyId, name: "B4 Browser Partner", industry: "Software Development", type: "Services", specializations: ["Web Development"],
  location: "Cebu City", slots: 0, description: "Browser acceptance fixture", website: "https://example.test/", email: "team@example.test",
  phone: "", hours: "Weekdays", image: "/getHiredLogo.png", status: "active" }
const extraCompanies = Array.from({ length: 20 }, (_, i) => ({ ...company, id: randomUUID(), name: i === 19 ? "Z Saved Off-page Partner" : `Extra Partner ${i}` }))
savedCompanies.add(extraCompanies.at(-1).id)
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
  if (req.url === "/api/auth/me") {
    if (holdSessionCheck) { sessionCheckHeld = true; await holdSessionCheck }
    return role && !expired ? finish(200, current()) : finish(401, null, "UNAUTHENTICATED")
  }
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
    refreshes++; expired = false; return finish(200, current())
  }
  if (req.url === "/api/auth/logout") {
    sessions.delete(id)
    res.setHeader("Set-Cookie", "b3-test-session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0")
    return finish(200, { loggedOut: true })
  }
  const url = new URL(req.url, "http://fixture")
  if (/^\/api\/(admin\/)?(categories|questions)(\/|$)/.test(url.pathname)) {
    if (!role) return finish(401, null, "UNAUTHENTICATED")
    if (url.pathname.includes("/admin/") && role !== "admin") return finish(403, null, "FORBIDDEN")
    if (req.method === "PATCH") {
      let raw = ""; for await (const chunk of req) raw += chunk
      if (url.pathname.includes("/questions/")) { bankQuestion = { ...bankQuestion, ...JSON.parse(raw) }; return finish(200, bankQuestion) }
      category = { ...category, ...JSON.parse(raw) }; return finish(200, category)
    }
    if (url.pathname.endsWith("/pipeline")) {
      if (bankQuestion.status === "inactive") return finish(409, null, "CATEGORY_UNAVAILABLE")
      const { feedback, status, ...safe } = bankQuestion
      return finish(200, [{ id: "intro", label: "Introduction", shortLabel: "Intro", questions: [safe] }])
    }
    const rows = url.pathname.endsWith("/questions") ? [bankQuestion] : category.status === "active" || role === "admin" ? [category] : []
    return res.end(JSON.stringify({ data: rows, meta: { page: 1, pageSize: 100, total: rows.length }, requestId: randomUUID() }))
  }
  if (/^\/api\/auth\/(signup|password-reset|invitations)/.test(url.pathname)) {
    let raw = ""; for await (const chunk of req) raw += chunk
    const body = JSON.parse(raw); onboardingRequests.push({ path: url.pathname, body })
    if (["/api/auth/signup", "/api/auth/signup/resend", "/api/auth/password-reset/request"].includes(url.pathname))
      return finish(202, { message: "Check your email for your code.", challengeId: randomUUID() })
    if (url.pathname.endsWith("/verify")) {
      if (body.code !== "123456") return finish(400, null, "INVALID_VERIFICATION_CODE")
      return finish(200, url.pathname.includes("signup") ? { accountReady: true, status: "active" } : { verified: true })
    }
    if (url.pathname === "/api/auth/password-reset/complete") { sessions.clear(); return finish(200, { passwordUpdated: true }) }
    return finish(200, { accountReady: true })
  }
  if (url.pathname.startsWith("/api/admin/students")) {
    if (role !== "admin") return finish(role ? 403 : 401, null, role ? "FORBIDDEN" : "UNAUTHENTICATED")
    if (req.method === "GET") {
      res.statusCode = 200
      return res.end(JSON.stringify({ data: [...registry.values()], meta: { page: 1, pageSize: 20, total: registry.size }, requestId: randomUUID() }))
    }
    let raw = ""; for await (const chunk of req) raw += chunk
    const body = JSON.parse(raw)
    if (url.pathname.endsWith("/invitations")) { invitations++; return finish(202, { message: "Invitation queued." }) }
    if (req.method === "POST") {
      const student = { ...body, id: randomUUID(), studentNumber: body.email.split("@")[0], status: "pending" }
      registry.set(student.id, student); return finish(201, student)
    }
    const id = url.pathname.split("/").at(-1), student = { ...registry.get(id), ...body }
    registry.set(id, student); return finish(200, student)
  }
  if (/^\/api\/(companies|admin\/companies|me\/bookmarks)/.test(url.pathname)) {
    if (!role || expired) return finish(401, null, "UNAUTHENTICATED")
    if (url.pathname.startsWith("/api/admin/") && role !== "admin" || url.pathname.startsWith("/api/me/") && role !== "student") return finish(403, null, "FORBIDDEN")
    if (url.pathname === `/api/admin/companies/${companyId}` && req.method === "PATCH") {
      let body = ""; for await (const chunk of req) body += chunk
      company = { ...company, ...JSON.parse(body) }; return finish(200, company)
    }
    if (url.pathname === `/api/me/bookmarks/${companyId}`) {
      if (req.method === "DELETE") { savedCompanies.delete(companyId); return finish(200, { removed: true }) }
      savedCompanies.add(companyId); return finish(200, { companyId, createdAt: new Date().toISOString(), company })
    }
    if (url.pathname === `/api/companies/${companyId}`) return company.status === "active" ? finish(200, { ...company, bookmarked: savedCompanies.has(companyId) }) : finish(404, null, "NOT_FOUND")
    let rows = (company.status === "active" || role === "admin" ? [company] : []).concat(extraCompanies).sort((a,b) => a.name.localeCompare(b.name))
    const q = url.searchParams.get("q") ?? ""
    if (url.pathname === "/api/companies" && q === "phase4-old") { oldSearchHeld = true; if (holdOldSearch) await holdOldSearch; rows = [{ ...company, name: "Stale Partner" }] }
    else if (url.pathname === "/api/companies" && q === "phase4-new") rows = [{ ...company, name: "Latest Partner" }]
    else if (q) rows = rows.filter(c => c.name.toLowerCase().includes(q.toLowerCase()))
    if (url.pathname === "/api/companies" && url.searchParams.get("page") === "2" && holdSecondPage) { secondPageHeld = true; await holdSecondPage }
    if (url.pathname === "/api/me/bookmarks") rows = rows.filter(c => savedCompanies.has(c.id)).map(c => ({ companyId: c.id, createdAt: new Date().toISOString(), company: c }))
    if (url.pathname === "/api/companies") rows = rows.map(c => ({ ...c, bookmarked: savedCompanies.has(c.id) }))
    const page = Number(url.searchParams.get("page") ?? 1), pageSize = Number(url.searchParams.get("pageSize") ?? 20), total = rows.length
    res.statusCode = 200
    return res.end(JSON.stringify({ data: rows.slice((page-1)*pageSize,page*pageSize), meta: { page, pageSize, total }, requestId: randomUUID() }))
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
  let sequence = 0; const pending = new Map(), performanceEvents = [], traffic = []
  ws.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data), task = pending.get(message.id)
    if (message.method === "Network.requestWillBeSent") {
      const url = new URL(message.params.request.url)
      if (url.pathname.startsWith("/api/")) traffic.push({ path: url.pathname, method: message.params.request.method })
    }
    if (message.method === "Runtime.bindingCalled" && message.params.name === "__getHiredPerfRecord")
      performanceEvents.push(JSON.parse(message.params.payload))
    if (task) { pending.delete(message.id); message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result) }
  })
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }))
  })
  await call("Page.enable"); await call("Runtime.enable"); await call("Network.enable")
  await call("Runtime.addBinding", { name: "__getHiredPerfRecord" })
  await call("Page.addScriptToEvaluateOnNewDocument", { source: browserTimingSource })
  await call("Page.addScriptToEvaluateOnNewDocument", { source: "window.__searchDebounces=0;const originalTimeout=window.setTimeout;window.setTimeout=function(fn,ms,...args){if(ms===180)window.__searchDebounces++;return originalTimeout(fn,ms,...args)};" })
  await call("Network.setExtraHTTPHeaders", { headers: { "x-smoke-ingress-ip": "127.0.0.1" } })
  const evaluate = async expression => {
    const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }
  return { call, evaluate, performanceEvents, traffic, navigate: url => call("Page.navigate", { url }) }
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
    // A server-rendered input can exist before React attaches its handlers.
    await until(async () => {
      await first.evaluate("document.querySelector('button[aria-label=\"Show password\"]')?.click()")
      return first.evaluate("document.querySelector('#password')?.type === 'text'")
    }, "login hydration")
    await first.evaluate("document.querySelector('button[aria-label=\"Hide password\"]').click()")
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
  const loginOffset = first.traffic.length
  await login("21100123")
  await until(() => first.evaluate("location.pathname === '/dashboard' && document.body.innerText.includes('Welcome, Browser!') && !document.querySelector('[role=status]')"), "student login")
  assert.equal(lastRemember, false)
  await delay(300)
  assert.equal(first.traffic.slice(loginOffset).filter(t => t.path === "/api/auth/me").length, 0, "server-validated session has no mount-time client read")
  assert.equal(first.traffic.slice(loginOffset).filter(t => t.path === "/api/me/bookmarks").length, 1, "home has one bookmark page, no ID walker")
  assert.equal(await first.evaluate("window.__searchDebounces"), 0, "initial loading is immediate")
  const freshOffset = first.traffic.length
  await first.evaluate("for (let i = 0; i < 3; i++) { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('pageshow')); document.dispatchEvent(new Event('visibilitychange')); }")
  await delay(200)
  assert.equal(first.traffic.slice(freshOffset).filter(t => t.path === "/api/auth/me").length, 0, "fresh focus burst makes no session request")
  const taskOffset = first.performanceEvents.length
  await first.evaluate("setTimeout(() => { const end = performance.now() + 80; while (performance.now() < end) {} }, 0)")
  await until(() => first.performanceEvents.slice(taskOffset).some(e => e.kind === "long_task" && e.duration >= 50), "long-task collector")
  await delay(15100)
  const focusOffset = first.traffic.length
  // Hold a focus-triggered session check open to verify navigation stays usable.
  let releaseSessionCheck
  holdSessionCheck = new Promise(resolve => { releaseSessionCheck = resolve })
  await first.call("Page.bringToFront")
  await until(async () => {
    await first.evaluate("window.dispatchEvent(new Event('focus'))")
    return sessionCheckHeld
  }, "background session check started")
  await first.evaluate("for (let i = 0; i < 4; i++) { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); }")
  assert.equal(first.traffic.slice(focusOffset).filter(t => t.path === "/api/auth/me").length, 1, "stale focus bursts coalesce")
  assert.equal(await first.evaluate("!!document.querySelector('[role=status], [inert]')"), false, "background check must not block the workspace")
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Explore').click()")
  await until(() => first.evaluate("document.body.innerText.includes('B4 Browser Partner')"), "live companies")
  let releaseSecondPage
  holdSecondPage = new Promise(resolve => { releaseSecondPage = resolve })
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Next' && !b.disabled).click()")
  await until(() => secondPageHeld, "next page requested")
  assert.equal(await first.evaluate("window.__searchDebounces"), 0, "pagination is immediate")
  assert.equal(await first.evaluate("document.body.innerText.includes('B4 Browser Partner')"), true, "previous rows remain during pagination")
  holdSecondPage = undefined; releaseSecondPage()
  await until(() => first.evaluate("document.body.innerText.includes('Z Saved Off-page Partner') && !!document.querySelector('button[title=Unsave]')"), "off-page company has server-projected bookmark state")
  await searchCompanies("B4")
  await until(() => first.evaluate("document.body.innerText.includes('B4 Browser Partner') && !document.querySelector('[role=status]')"), "search resets page two")
  await searchCompanies("")
  await until(() => first.evaluate("document.body.innerText.includes('Page 1 of 2') && !document.querySelector('[role=status]')"), "cleared search stays on first page")
  const beforeSearchDebounces = await first.evaluate("window.__searchDebounces")
  let releaseOldSearch
  holdOldSearch = new Promise(resolve => { releaseOldSearch = resolve })
  async function searchCompanies(value) {
    await first.evaluate(`(() => { const input=document.querySelector('input[placeholder="Search companies, specializations, or locations..."]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true})); })()`)
  }
  await searchCompanies("phase4-old")
  await until(() => oldSearchHeld, "debounced search sent")
  assert.equal(await first.evaluate("document.body.innerText.includes('B4 Browser Partner')"), true, "search keeps prior rows")
  assert.equal(await first.evaluate("window.__searchDebounces"), beforeSearchDebounces + 1, "text search is debounced")
  await searchCompanies("phase4-new")
  await until(() => first.evaluate("document.body.innerText.includes('Latest Partner')"), "latest search completes first")
  holdOldSearch = undefined; releaseOldSearch(); await delay(200)
  assert.equal(await first.evaluate("document.body.innerText.includes('Stale Partner')"), false, "superseded response ignored")
  await searchCompanies("")
  await until(() => first.evaluate("document.body.innerText.includes('B4 Browser Partner') && !document.querySelector('[role=status]')"), "search cleared")
  const refreshOffset = first.traffic.length, debounceCount = await first.evaluate("window.__searchDebounces")
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Refresh' && b.getClientRects().length).click()")
  await until(() => first.traffic.slice(refreshOffset).some(t => t.path === "/api/companies"), "explicit refresh requested")
  await until(() => first.evaluate("!document.querySelector('[role=status]')"), "explicit refresh loaded")
  assert.equal(await first.evaluate("window.__searchDebounces"), debounceCount, "refresh does not debounce")
  holdSessionCheck = undefined
  releaseSessionCheck()
  await first.evaluate("document.querySelector('button[title=\"Save Company\"]').click()")
  await until(() => first.evaluate("!!document.querySelector('button[title=Unsave]')"), "persist bookmark")
  assert.ok(savedCompanies.has(companyId))
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('know more')).click()")
  await until(() => first.evaluate("!!document.querySelector('button[aria-label=\"Close company details\"]') && [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Saved')"), "detail shows authoritative saved state")
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Unsave').click()")
  await until(() => first.evaluate("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Save Company')"), "detail unsaves")
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save Company').click()")
  await until(() => first.evaluate("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Saved')"), "detail saves again")
  await first.evaluate("document.querySelector('button[aria-label=\"Close company details\"]').click()")
  await delay(150)
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Home').click()")
  await until(() => first.evaluate("document.body.innerText.includes('Saved Companies') && !document.querySelector('[role=status]')"), "home invalidates bookmarks after write")
  const revisitOffset = first.traffic.length
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Explore').click()")
  await delay(150)
  assert.equal(first.traffic.slice(revisitOffset).filter(t => t.path === "/api/companies").length, 0, "unchanged Explore data reused between tabs")
  await first.navigate(`${base}/dashboard`)
  await until(() => first.evaluate("document.body.innerText.includes('B4 Browser Partner')"), "bookmark survives reload")
  const studentCookie = [...sessions.keys()][0]
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Interview').click()")
  await until(() => first.evaluate("document.body.innerText.includes('B6 Browser Track')"), "B6 categories from API")
  const studentCategoryReads = first.traffic.filter(t => t.path === "/api/categories").length
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Home').click()")
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Interview').click()")
  await until(() => first.evaluate("document.body.innerText.includes('B6 Browser Track')"), "cached student category tab")
  assert.equal(first.traffic.filter(t => t.path === "/api/categories").length, studentCategoryReads)
  bankQuestion.status = "inactive"
  await first.evaluate("[...document.querySelectorAll('h3')].find(h => h.textContent === 'B6 Browser Track').click()")
  await until(() => first.evaluate("document.querySelector('[role=alert]')?.textContent.includes('CATEGORY_UNAVAILABLE')"), "B6 shortage shown without fallback")
  bankQuestion.status = "active"
  await first.evaluate("[...document.querySelectorAll('h3')].find(h => h.textContent === 'B6 Browser Track').click()")
  await until(() => first.evaluate("document.body.innerText.includes('B6 introduce yourself')"), "B6 server-selected prompt")
  assert.equal(await first.evaluate("document.body.innerText.includes('B6_PRIVATE_RUBRIC')"), false)
  await first.navigate(`${base}/dashboard`)
  const wrongRole = await fetch(`${base}/admin`, { headers: { ...ingress, cookie: `b3-test-session=${studentCookie}` } })
  const denied = await wrongRole.text()
  assert.match(denied, /Access denied/); assert.doesNotMatch(denied, /DCISM Student Registry/)
  const second = await tab(debugPort)
  await second.navigate(`${base}/dashboard`)
  await until(() => second.evaluate("document.body.innerText.includes('Welcome, Browser!') && !document.querySelector('[role=status]')"), "second tab")
  expired = true
  const recoveryStart = Date.now(), recoveryOffset = first.performanceEvents.length, secondRecoveryOffset = second.performanceEvents.length
  // Both page GETs see expired access; browser recovery coordinates the refresh.
  await Promise.all([first.navigate(`${base}/dashboard`), second.navigate(`${base}/dashboard`)])
  await until(async () => (await Promise.all([first, second].map(t => t.evaluate("document.body.innerText.includes('Welcome, Browser!') && !document.querySelector('[role=status]')")))).every(Boolean), "cross-tab refresh")
  assert.equal(refreshes, 1)
  const recoveryObservations = () => [first.performanceEvents.slice(recoveryOffset), second.performanceEvents.slice(secondRecoveryOffset)]
    .map(events => summarizeNavigation(events, [], recoveryStart, Date.now()))
  await until(() => recoveryObservations().some(metrics => metrics.documentCount === 1 && metrics.checkingVisibleMs > 0), "recovery screen is measured without a document reload")
  assert.ok(recoveryObservations().every(metrics => metrics.documentCount === 1), "both tabs recover without replacing the document")
  outage = true
  await first.evaluate("(() => { const channel = new BroadcastChannel('gethired-session'); channel.postMessage('changed'); channel.close(); })()")
  await until(() => first.evaluate("document.querySelector('aside[role=alert]')?.textContent.includes('SERVICE_UNAVAILABLE')"), "routine service failure shows a retry banner")
  assert.equal(await first.evaluate("!!document.querySelector('[role=status], [inert]')"), false, "transient revalidation does not block the workspace")
  assert.equal(await first.evaluate("location.pathname"), "/dashboard")
  outage = false
  await first.evaluate("document.querySelector('aside[role=alert] button').click()")
  await until(() => first.evaluate("!document.querySelector('aside[role=alert]')"), "retry clears routine service failure")
  expired = true
  await second.navigate(`${base}/admin`)
  await until(() => second.evaluate("document.body.innerText.includes('Access denied')"), "recovered student is denied the admin workspace")
  assert.equal(await second.evaluate("document.body.innerText.includes('DCISM Student Registry')"), false)
  await second.navigate(`${base}/dashboard`)
  await until(() => second.evaluate("document.body.innerText.includes('Welcome, Browser!')"), "student returns to own workspace")

  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Log out').click()")
  await until(() => first.evaluate("location.pathname === '/login' && !!document.querySelector('#identifier')"), "logout")
  assert.equal(sessions.size, 0)
  await second.call("Page.bringToFront")
  await second.evaluate("window.dispatchEvent(new Event('focus'))")
  await until(() => second.evaluate("location.pathname === '/login'"), "other tab logout")
  const adminLoginOffset = first.traffic.length
  await login("admin@example.test")
  await until(() => first.evaluate("location.pathname === '/admin' && document.body.innerText.includes('Browser Test Admin') && !document.querySelector('[role=status]')"), "admin login")
  await until(() => first.evaluate("!!document.querySelector('button[title=\"Edit Company\"]')"), "admin company list")
  assert.equal(first.traffic.slice(adminLoginOffset).filter(t => t.path === "/api/admin/categories").length, 0, "admin bank is not eagerly loaded")
  await first.evaluate("(() => { const select=document.querySelector('select[aria-label=\"Company status\"]');select.value='active';select.dispatchEvent(new Event('change',{bubbles:true})); })()")
  await delay(100)
  assert.equal(await first.evaluate("window.__searchDebounces"), 0, "filter edits are immediate")
  await first.evaluate("(() => { const select=document.querySelector('select[aria-label=\"Company status\"]');select.value='all';select.dispatchEvent(new Event('change',{bubbles:true})); })()")
  await until(() => first.evaluate("!document.querySelector('[role=status]')"), "filter reset loaded")
  assert.equal(first.traffic.slice(adminLoginOffset).filter(t => t.path === "/api/auth/me").length, 0, "admin mount does not revalidate server session")
  expired = true
  const adminRecoveryOffset = first.performanceEvents.length, adminRecoveryStart = Date.now(), adminRefreshes = refreshes
  await first.navigate(`${base}/admin`)
  await until(() => first.evaluate("location.pathname === '/admin' && document.body.innerText.includes('Browser Test Admin') && !!document.querySelector('button[title=\"Edit Company\"]')"), "admin recovers without reload")
  await until(() => first.performanceEvents.slice(adminRecoveryOffset).some(e => e.kind === "checking_end"), "admin recovery is measured")
  assert.equal(summarizeNavigation(first.performanceEvents.slice(adminRecoveryOffset), [], adminRecoveryStart, Date.now()).documentCount, 1)
  assert.equal(refreshes, adminRefreshes + 1)

  await first.evaluate("document.querySelector('button[title=\"Edit Company\"]').click()")
  await first.evaluate(`(() => { const input=document.querySelector('input[aria-label="Company name"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'B4 Updated Partner'); input.dispatchEvent(new Event('input',{bubbles:true})); })()`)
  await first.evaluate("document.querySelector('input[aria-label=\"Company name\"]').closest('form').requestSubmit()")
  await until(() => first.evaluate("!document.querySelector('input[aria-label=\"Company name\"]') && document.body.innerText.includes('B4 Updated Partner')"), "admin edit saved")
  assert.equal(company.name, "B4 Updated Partner")
  await first.evaluate("document.querySelector('button[title=\"Deactivate Company\"]').click()")
  await first.evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Yes, Deactivate').click()")
  await until(() => first.evaluate("!!document.querySelector('button[title=\"Reactivate Company\"]')"), "company deactivated")
  assert.equal(company.status, "inactive")
  await first.evaluate("document.querySelector('button[title=\"Reactivate Company\"]').click()")
  await first.evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Yes, Reactivate').click()")
  await until(() => first.evaluate("!!document.querySelector('button[title=\"Edit Company\"]')"), "company reactivated")
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Students').click()")
  await until(() => first.evaluate("document.body.innerText.includes('No students match your search.')"), "live student registry")
  assert.equal(await first.evaluate("document.body.innerText.includes('Generated Default Password')"), false)
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Add student').click()")
  async function fill(fields) {
    await first.evaluate(`(() => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      for (const [name,value] of ${JSON.stringify(Object.entries(fields))}) { const input = document.querySelector('input[name="'+name+'"]'); setter.call(input,value); input.dispatchEvent(new Event('input',{bubbles:true})); }
    })()`)
  }
  await fill({ firstName: "Registry", lastName: "Student", email: "87654321@usc.edu.ph" })
  await first.evaluate("document.querySelector('[role=dialog] form').requestSubmit()")
  await until(() => first.evaluate("!document.querySelector('[role=dialog]') && document.body.innerText.includes('Registry Student')"), "registry student saved")
  assert.equal(registry.size, 1)
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Send invitation').click()")
  await until(() => invitations === 1, "invitation requested")
  await until(() => first.evaluate("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Edit' && !b.disabled)"), "registry reload after invitation")
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Edit').click()")
  await fill({ firstName: "Updated" })
  await first.evaluate("document.querySelector('[role=dialog] form').requestSubmit()")
  await until(() => first.evaluate("!document.querySelector('[role=dialog]') && document.body.innerText.includes('Updated Student')"), "registry edit saved")
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Interviews')).click()")
  await until(() => first.evaluate("!!document.querySelector('button[title=\"Edit Category Info\"]')"), "B6 admin categories")
  const categoryReads = first.traffic.filter(t => t.path === "/api/admin/categories" && t.method === "GET").length
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Companies')).click()")
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Interviews')).click()")
  await until(() => first.evaluate("!!document.querySelector('button[title=\"Edit Category Info\"]')"), "cached category tab")
  assert.equal(first.traffic.filter(t => t.path === "/api/admin/categories" && t.method === "GET").length, categoryReads)
  await first.evaluate("document.querySelector('button[title=\"Edit Category Info\"]').click()")
  await until(() => first.evaluate("!!document.querySelector('input[aria-label=\"Phase 1 name\"]')"), "B6 phase editor")
  await first.evaluate("document.querySelector('input[aria-label=\"Phase 1 name\"]').closest('form').requestSubmit()")
  await until(() => first.evaluate("!document.querySelector('input[aria-label=\"Phase 1 name\"]')"), "B6 category save")
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.includes('Manage Questions')).click()")
  await until(() => first.evaluate("document.body.innerText.includes('B6_PRIVATE_RUBRIC')"), "B6 rubric available only to admin bank")
  await first.evaluate("document.querySelector('button[title=\"Edit Question\"]').click()")
  await until(() => first.evaluate("!!document.querySelector('textarea[placeholder=\"Type the question interviewer will ask...\"]')"), "B6 question editor")
  await first.evaluate("document.querySelector('textarea[placeholder=\"Type the question interviewer will ask...\"]').closest('form').requestSubmit()")
  await until(() => first.evaluate("!document.querySelector('textarea[placeholder=\"Type the question interviewer will ask...\"]')"), "B6 question save")
  assert.equal(bankQuestion.feedback, "B6_PRIVATE_RUBRIC")
  outage = true
  const outageOffset = first.performanceEvents.length
  await first.navigate(`${base}/admin`)
  await until(() => first.evaluate("document.body.innerText.includes('Unable to load your workspace')"), "outage view")
  assert.equal(await first.evaluate("location.pathname"), "/admin")
  outage = false
  await until(() => first.evaluate("Object.keys([...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Try again') ?? {}).some(k => k.startsWith('__reactProps$'))"), "outage retry hydrated")
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Try again').click()")
  await until(() => first.evaluate("document.body.innerText.includes('Browser Test Admin') && Object.keys([...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Log out') ?? {}).some(k => k.startsWith('__reactProps$'))"), "admin recovers")
  assert.equal(first.performanceEvents.slice(outageOffset).filter(e => e.kind === "document").length, 1, "initial outage retry avoids document reload")
  await first.evaluate("[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Log out').click()")
  await until(() => first.evaluate("!!document.querySelector('#identifier')"), "admin logout")
  await login("21100123")
  await until(() => first.evaluate("document.body.innerText.includes('B4 Updated Partner')"), "admin change visible to student after login/refetch")
  await first.navigate(`${base}/signup`)
  await until(() => first.evaluate("Object.keys(document.querySelector('input[name=firstName]') ?? {}).some(k => k.startsWith('__reactProps$'))"), "signup form hydrated")
  await fill({ firstName: "Signup", lastName: "Student", email: "12345678@usc.edu.ph", newPassword: "browser chosen password" })
  await first.evaluate("document.querySelector('form').requestSubmit()")
  await until(() => first.evaluate("!!document.querySelector('input[name=code]')"), "signup code form")
  await fill({ code: "999999" }); await first.evaluate("document.querySelector('form').requestSubmit()")
  await until(() => first.evaluate("document.querySelector('[role=alert]')?.textContent.includes('INVALID_VERIFICATION_CODE')"), "wrong signup code displayed")
  await fill({ code: "123456" }); await first.evaluate("document.querySelector('form').requestSubmit()")
  await until(() => first.evaluate("document.body.innerText.includes('Your account is active.')"), "signup verified")
  assert.equal(onboardingRequests.find(r => r.path === "/api/auth/signup").body.course, "BS Computer Science")
  assert.equal(onboardingRequests.filter(r => r.path === "/api/auth/signup/verify").at(-1).body.newPassword, "browser chosen password")
  await first.navigate(`${base}/password-reset`)
  await until(() => first.evaluate("Object.keys(document.querySelector('input[name=email]') ?? {}).some(k => k.startsWith('__reactProps$'))"), "recovery form hydrated")
  await fill({ email: "12345678@usc.edu.ph" }); await first.evaluate("document.querySelector('form').requestSubmit()")
  await until(() => first.evaluate("!!document.querySelector('input[name=code]')"), "recovery code")
  await fill({ code: "123456" }); await first.evaluate("document.querySelector('form').requestSubmit()")
  await until(() => first.evaluate("!!document.querySelector('input[name=newPassword]')"), "new password form")
  await fill({ newPassword: "browser reset password" }); await first.evaluate("document.querySelector('form').requestSubmit()")
  await until(() => first.evaluate("document.body.innerText.includes('all devices have been signed out')"), "recovery complete")
  await first.navigate(`${base}/invite#token_hash=${"a".repeat(56)}`)
  await until(() => first.evaluate("!!document.querySelector('input[name=newPassword]') && location.hash === ''"), "invitation fragment removed")
  await fill({ newPassword: "browser invite password" }); await first.evaluate("document.querySelector('form').requestSubmit()")
  await until(() => first.evaluate("document.body.innerText.includes('Your account is active.')"), "invitation accepted")
  assert.equal(onboardingRequests.at(-1).body.tokenHash, "a".repeat(56))
  console.log("B3/B4/B5/B6 browser smoke passed: sessions, companies/bookmarks, registry/onboarding, API categories, pipeline shortage/recovery, public prompts, admin phases/question edits and private rubric visibility. Uses isolated HTTP fixtures; hosted Supabase remains unverified.")
} finally {
  for (const ws of sockets) ws.close()
  for (const child of children.reverse()) if (child.exitCode === null) child.kill()
  fixture.closeAllConnections(); await new Promise(resolve => fixture.close(resolve))
}
