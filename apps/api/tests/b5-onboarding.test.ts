import assert from "node:assert/strict"
import { test } from "node:test"
import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
import { createAuthStore, type SqlClient, type SqlPool } from "../src/auth/store.js"
import { createBrowserSecurity } from "../src/auth/cookies.js"
import type { AuthConfig } from "../src/auth/config.js"
import { ApiError } from "../src/api/errors.js"
import { createOnboardingService } from "../src/modules/onboarding/service.js"
import { createSetupProvider, type ProofType } from "../src/modules/onboarding/provider.js"
import { createStudentRepository } from "../src/modules/onboarding/students.js"
import { otpDigest, setupConfig, setupCrypto } from "../src/modules/onboarding/security.js"
import { signupInput, studentInput, studentPatch, studentQuery, passwordInput } from "../src/modules/onboarding/input.js"

const auth: AuthConfig = { enabled: true, production: false, supabaseUrl: "https://test.supabase.co", publishableKey: "publishable", databaseUrl: "", algorithms: ["ES256"], cookieSecret: "a".repeat(64) }
const setup = { key: "b".repeat(64), adminKey: "sb_secret_test", ttl: 600 }
const origin = "http://localhost:3000"
const input = { firstName: "Test", lastName: "Student", email: "12345678@usc.edu.ph", course: "BS Computer Science", yearLevel: "4th Year", password: "a long chosen password" } as const
function browserRequest() {
  const browser = createBrowserSecurity(auth, origin), headers = new Headers(), binding = browser.issueBinding(headers)
  const cookie = headers.getSetCookie().map(value => value.split(";")[0]).join("; ")
  return (extra = "") => new Request(`${origin}/api/auth/signup`, { method: "POST", headers: { origin, cookie: cookie + extra, "x-csrf-token": browser.csrfToken(binding) } })
}
async function fixture() {
  const db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email text unique, email_confirmed_at timestamptz, banned_until timestamptz,
      confirmation_token text, recovery_token text, confirmation_sent_at timestamptz, recovery_sent_at timestamptz);
    create table auth.sessions(id uuid primary key, user_id uuid references auth.users(id), not_after timestamptz);
    create table auth.refresh_tokens(session_id uuid references auth.sessions(id) on delete cascade, revoked boolean);`)
  for (const name of ["202609290001_phase3_auth.sql", "202610050001_b2_operations.sql", "202610120001_b3_feature_foundation.sql", "202610120002_b4_companies.sql", "202610130001_b5_onboarding.sql"])
    await db.exec(await readFile(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8"))
  const client = { query: async (sql: string, values?: unknown[]) => { const result = await db.query(sql, values); return { rows: result.rows, rowCount: result.affectedRows ?? 0 } }, release() {} } as SqlClient
  const pool: SqlPool = { connect: async () => client }
  const codes = new Map<string, string>(), passwords = new Map<string, string>()
  let sequence = 100000, failSend = false, failPassword = false, loseVerifyResponse = false, sends = 0, ended = 0
  async function operator<T>(work: () => Promise<T>) { await db.exec("reset role"); try { return await work() } finally { await db.exec("set role gethired_runtime") } }
  const provider: ReturnType<typeof createSetupProvider> = {
    async signup(email, password) { await this.send(email, "signup"); passwords.set(email, password) },
    async send(email, type) {
      sends++
      if (failSend) throw new ApiError("SERVICE_UNAVAILABLE")
      await operator(async () => {
        await db.query("insert into auth.users(id,email) values ($1,$2) on conflict(email) do nothing", [randomUUID(), email])
        const code = String(++sequence); codes.set(email, code)
        const prefix = type === "recovery" ? "recovery" : "confirmation"
        await db.query(`update auth.users set ${prefix}_token = $2, ${prefix}_sent_at = clock_timestamp() where email = $1`, [email, otpDigest(email, code)])
      })
    },
    async verify(hash, type) {
      const result = await operator(async () => {
        const prefix = type === "recovery" ? "recovery" : "confirmation"
        const user = (await db.query<{ id: string; email: string }>(`update auth.users set ${prefix}_token = '', email_confirmed_at = now() where ${prefix}_token = $1 returning id,email`, [hash])).rows[0]
        if (!user) throw new ApiError("INVALID_VERIFICATION_CODE")
        const sessionId = randomUUID()
        await db.query("insert into auth.sessions values ($1,$2,null)", [sessionId, user.id])
        await db.query("insert into auth.refresh_tokens values ($1,false)", [sessionId])
        return { accessToken: "temporary-access", refreshToken: "temporary-refresh", userId: user.id, email: user.email, sessionId }
      })
      if (loseVerifyResponse) { loseVerifyResponse = false; throw new ApiError("SERVICE_UNAVAILABLE") }
      return result
    },
    async end() { ended++ },
    async password(userId, password) {
      if (failPassword) throw new ApiError("SERVICE_UNAVAILABLE")
      await operator(async () => { const user = (await db.query<{ email: string }>("select email from auth.users where id=$1", [userId])).rows[0]; passwords.set(user.email, password) })
    },
  }
  await db.exec("set role gethired_runtime")
  const service = () => createOnboardingService({ pool, auth, setup, appOrigin: origin, provider, limits: { consumeLimit: async () => {} } })
  async function admin() {
    const userId = randomUUID(), accountId = randomUUID(), sessionId = randomUUID()
    await operator(async () => {
      await db.query("insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now())", [userId, `${userId}@example.test`])
      await db.query("insert into gethired_private.accounts(id,auth_user_id,email,display_name,role,status) values ($1,$2,$3,'Admin','admin','active')", [accountId, userId, `${userId}@example.test`])
      await db.query("insert into auth.sessions values ($1,$2,null)", [sessionId, userId]); await db.query("insert into auth.refresh_tokens values ($1,false)", [sessionId])
    })
    return createAuthStore(pool).createSession({ userId, sessionId }, false)
  }
  async function studentSession(email = input.email) {
    const row = (await db.query<{ id: string; auth_user_id: string }>("select id,auth_user_id from gethired_private.accounts where email=$1", [email])).rows[0]
    const sessionId = randomUUID()
    await operator(async () => { await db.query("insert into auth.sessions values ($1,$2,null)", [sessionId, row.auth_user_id]); await db.query("insert into auth.refresh_tokens values ($1,false)", [sessionId]) })
    return createAuthStore(pool).createSession({ userId: row.auth_user_id, sessionId }, false)
  }
  return { db, pool, operator, service, codes, passwords, admin, studentSession,
    failSend: (value: boolean) => { failSend = value }, failPassword: (value: boolean) => { failPassword = value }, loseVerify: () => { loseVerifyResponse = true },
    sent: () => sends, ended: () => ended, close: () => db.close() }
}
const challenge = (result: { data: unknown }) => (result.data as { challengeId: string }).challengeId

test("B5 strict inputs, password preservation and purpose-authenticated encryption", () => {
  assert.equal(signupInput({ ...input, email: "12345678@USC.EDU.PH" }).email, input.email)
  for (const change of [{ email: "123@usc.edu.ph" }, { role: "admin" }, { status: "active" }, { studentNumber: "99999999" }, { course: "unknown" }, { yearLevel: "6th Year" }, { password: "short" }])
    assert.throws(() => signupInput({ ...input, ...change }), { code: "VALIDATION_ERROR" })
  assert.equal(passwordInput("  twelve characters  "), "  twelve characters  ")
  assert.throws(() => studentPatch({ email: "87654321@usc.edu.ph" }))
  assert.throws(() => studentPatch({ status: "pending" }))
  for (const q of ["q=a&q=b", "status=bad", "pageSize=101", "role=admin"]) assert.throws(() => studentQuery(new URLSearchParams(q)))
  assert.throws(() => setupConfig(auth, { AUTH_SETUP_ENCRYPTION_KEY: auth.cookieSecret, SUPABASE_AUTH_SECRET_KEY: "key" }))
  const crypto = setupCrypto(setup.key), sealed = crypto.seal("provider-secret", "one")
  assert.equal(crypto.open(sealed, "one"), "provider-secret")
  assert.ok(!sealed.includes("provider-secret")); assert.throws(() => crypto.open(sealed, "two")); assert.throws(() => crypto.open(sealed.slice(1), "one"))
})

test("B5 provider adapter uses purpose-specific proofs, privileged server updates and sanitized failures", async () => {
  const requests: Request[] = [], userId = randomUUID(), sessionId = randomUUID()
  const payload = Buffer.from(JSON.stringify({ sub: userId, session_id: sessionId })).toString("base64url")
  const token = `eyJhbGciOiJFUzI1NiJ9.${payload}.fixture`
  const provider = createSetupProvider(auth, setup, origin, async (url, init) => {
    const request = new Request(url, init); requests.push(request)
    if (request.url.includes("/verify")) return Response.json({ access_token: token, refresh_token: "refresh", user: { id: userId, email: input.email, email_confirmed_at: new Date().toISOString() } })
    if (request.url.includes("/logout")) return new Response(null, { status: 204 })
    return Response.json({})
  })
  await provider.signup(input.email, input.password)
  for (const type of ["signup", "invite", "recovery"] as ProofType[]) {
    await provider.send(input.email, type, type === "invite")
    const verified = await provider.verify("a".repeat(56), type)
    assert.equal(verified.sessionId, sessionId)
    assert.deepEqual(await requests.at(-1)!.json(), { type, token_hash: "a".repeat(56) })
  }
  await provider.password(userId, input.password); await provider.end(token)
  const password = requests.find(r => r.url.includes(`/admin/users/${userId}`))!
  assert.equal(password.method, "PUT"); assert.equal(password.headers.get("apikey"), setup.adminKey)
  assert.equal(requests.find(r => r.url.includes("/invite?"))!.headers.get("apikey"), setup.adminKey)
  assert.ok(requests.every(r => r.redirect === "error" && r.cache === "no-store"))
  assert.equal(requests.at(-1)!.headers.get("authorization"), `Bearer ${token}`)
  for (const [status, code] of [[400, "INVALID_VERIFICATION_CODE"], [429, "RATE_LIMITED"], [500, "SERVICE_UNAVAILABLE"]] as const) {
    const failing = createSetupProvider(auth, setup, origin, async () => new Response("private-provider-detail", { status }))
    await assert.rejects(failing.verify("a".repeat(56), "recovery"), (error: unknown) => error instanceof ApiError && error.code === code && !error.message.includes("private-provider-detail"))
  }
})

test("B5 activation requires the bound latest proof; pending reservations cannot overwrite the verified profile", async () => {
  const f = await fixture()
  try {
    const request = browserRequest(), other = browserRequest(), service = f.service()
    const first = challenge(await service.signup(request(), input)), oldCode = f.codes.get(input.email)!
    assert.equal((await f.db.query("select id from gethired_private.accounts")).rows.length, 0)
    await assert.rejects(service.verifySignup(other(), first, oldCode, input.password), { code: "INVALID_VERIFICATION_CODE" })
    const next = challenge(await service.resend(request(), first))
    await assert.rejects(service.verifySignup(request(), first, oldCode, input.password), { code: "INVALID_VERIFICATION_CODE" })
    await assert.rejects(service.verifySignup(request(), next, oldCode, input.password), { code: "INVALID_VERIFICATION_CODE" })
    const verified = await f.service().verifySignup(request(), next, f.codes.get(input.email)!, "verified owner's password")
    assert.deepEqual(verified.data, { accountReady: true, status: "active" }); assert.equal(verified.headers, undefined)
    assert.equal(f.passwords.get(input.email), "verified owner's password"); assert.equal(f.ended(), 1)
    const account = (await f.db.query<{ role: string; status: string }>("select * from gethired_private.accounts")).rows[0]
    assert.equal(account.role, "student"); assert.equal(account.status, "active")
    await assert.rejects(service.verifySignup(request(), next, f.codes.get(input.email)!, input.password), { code: "INVALID_VERIFICATION_CODE" })
    const sent = f.sent(); await service.signup(other(), { ...input, firstName: "Attacker" }); assert.equal(f.sent(), sent)
    assert.equal((await f.db.query<{ first_name: string }>("select first_name from gethired_private.student_profiles")).rows[0].first_name, "Test")
    const persisted = JSON.stringify((await f.db.query("select * from gethired_private.onboarding_operations")).rows)
    assert.ok(!persisted.includes(input.password)); assert.ok(!persisted.includes("temporary-access")); assert.ok(!persisted.includes(oldCode))
    await f.studentSession()
    await f.operator(async () => { assert.equal((await f.db.query("select * from auth.sessions")).rows.length, 1) })
  } finally { await f.close() }
})

test("B5 registry permissions, invitation/signup convergence, immutable identity and revocation on deactivation", async () => {
  const f = await fixture()
  try {
    const actor = await f.admin(), repo = createStudentRepository(f.pool), request = browserRequest()
    const { password, ...profile } = input
    const student = await repo.create(actor, randomUUID(), studentInput(profile))
    assert.equal(student.status, "pending"); assert.equal(student.studentNumber, "12345678")
    await assert.rejects(repo.create(actor, randomUUID(), profile), { code: "CONFLICT" })
    await assert.rejects(repo.patch(actor, randomUUID(), student.id, { status: "active" } as ReturnType<typeof studentPatch>), { code: "CONFLICT" })
    await f.service().invite(actor, randomUUID(), student.id)
    const invitation = otpDigest(input.email, f.codes.get(input.email)!)
    const signup = challenge(await f.service().signup(request(), { ...input, firstName: "Unverified replacement" }))
    await assert.rejects(f.service().acceptInvitation(request(), invitation, input.password), { code: "INVALID_VERIFICATION_CODE" })
    await f.service().verifySignup(request(), signup, f.codes.get(input.email)!, input.password)
    assert.equal((await repo.list(actor, studentQuery(new URLSearchParams("q=12345678")))).data[0].firstName, profile.firstName)
    const own = await f.studentSession()
    await assert.rejects(repo.list(own, studentQuery(new URLSearchParams())), { code: "FORBIDDEN" })
    await repo.patch(actor, randomUUID(), student.id, studentPatch({ status: "inactive" }))
    await assert.rejects(createAuthStore(f.pool).withSession(own.session.id, own.identity, false, async () => {}), { code: "SESSION_EXPIRED" })
    const sent = f.sent(); await f.service().signup(request(), input); await f.service().requestRecovery(request(), input.email); assert.equal(f.sent(), sent)
    await repo.patch(actor, randomUUID(), student.id, studentPatch({ status: "active" }))
    await assert.rejects(createAuthStore(f.pool).withSession(own.session.id, own.identity, false, async () => {}), { code: "SESSION_EXPIRED" })
    await f.operator(async () => { assert.equal((await f.db.query("select * from gethired_private.audit_events where resource_type='student'")).rows.length, 4) })
  } finally { await f.close() }
})

test("B5 invitations are single-use setup proofs and require a fresh login", async () => {
  const f = await fixture()
  try {
    const actor = await f.admin(), request = browserRequest(), { password, ...profile } = input
    const student = await createStudentRepository(f.pool).create(actor, randomUUID(), profile)
    await f.service().invite(actor, randomUUID(), student.id)
    const hash = otpDigest(input.email, f.codes.get(input.email)!)
    assert.deepEqual((await f.service().acceptInvitation(request(), hash, password)).data, { accountReady: true })
    await assert.rejects(f.service().acceptInvitation(request(), hash, password), { code: "INVALID_VERIFICATION_CODE" })
    await f.studentSession()
  } finally { await f.close() }
})

test("B5 recovery grant is browser/purpose bound; ambiguous password writes block login and successful retry revokes every device", async () => {
  const f = await fixture()
  try {
    const request = browserRequest(), other = browserRequest()
    const id = challenge(await f.service().signup(request(), input))
    await f.service().verifySignup(request(), id, f.codes.get(input.email)!, input.password)
    const first = await f.studentSession(), second = await f.studentSession()
    const oldVersion = await createAuthStore(f.pool).credentialVersion(input.email)
    const recovery = challenge(await f.service().requestRecovery(request(), input.email)), code = f.codes.get(input.email)!
    await assert.rejects(f.service().verifySignup(request(), recovery, code, input.password), { code: "INVALID_VERIFICATION_CODE" })
    const grant = await f.service().verifyRecovery(request(), recovery, code)
    const cookie = new Headers(grant.headers).getSetCookie()[0].split(";")[0]
    assert.match(cookie, /recovery=/); assert.ok(!cookie.includes("temporary"))
    await assert.rejects(f.service().completeRecovery(other(`; ${cookie}`), input.password), { code: "INVALID_RECOVERY_CODE" })
    f.failPassword(true)
    await assert.rejects(f.service().completeRecovery(request(`; ${cookie}`), "new chosen password"), { code: "SERVICE_UNAVAILABLE" })
    for (const session of [first, second]) await assert.rejects(createAuthStore(f.pool).withSession(session.session.id, session.identity, false, async () => {}), { code: "SESSION_EXPIRED" })
    await assert.rejects(f.studentSession(), { code: "INVALID_CREDENTIALS" })
    f.failPassword(false)
    assert.deepEqual((await f.service().completeRecovery(request(`; ${cookie}`), "new chosen password")).data, { passwordUpdated: true })
    await assert.rejects(f.service().completeRecovery(request(`; ${cookie}`), "another password"), { code: "INVALID_RECOVERY_CODE" })
    await f.operator(async () => assert.equal((await f.db.query("select * from auth.sessions")).rows.length, 0))
    assert.equal(f.passwords.get(input.email), "new chosen password")
    const fresh = await f.studentSession()
    await assert.rejects(createAuthStore(f.pool).createSession(fresh.identity, false, oldVersion!), { code: "INVALID_CREDENTIALS" })
  } finally { await f.close() }
})

test("B5 provider response loss reconciles a bound matched proof, and delivery failures remain retryable", async () => {
  const f = await fixture()
  try {
    const request = browserRequest()
    f.failSend(true)
    const id = challenge(await f.service().signup(request(), input))
    assert.equal((await f.db.query<{ state: string }>("select state from gethired_private.onboarding_operations where id=$1", [id])).rows[0].state, "queued")
    f.failSend(false)
    // A fresh signup supplies the password again; background retries never retain it.
    const next = challenge(await f.service().signup(request(), input)), code = f.codes.get(input.email)!
    f.loseVerify()
    await assert.rejects(f.service().verifySignup(request(), next, code, input.password), { code: "SERVICE_UNAVAILABLE" })
    await f.operator(async () => {
      await f.db.exec("set role gethired_maintenance")
      await f.db.query("select gethired_private.prune_onboarding(100)")
      await f.db.query("select gethired_private.process_provider_cleanup(100)")
      await f.db.exec("reset role")
      assert.equal((await f.db.query("select id from auth.sessions")).rows.length, 0)
    })
    await assert.rejects(f.service().verifySignup(request(), next, "999999", input.password), { code: "INVALID_VERIFICATION_CODE" })
    assert.deepEqual((await f.service().verifySignup(request(), next, code, input.password)).data, { accountReady: true, status: "active" })
  } finally { await f.close() }
})

test("B5 expired/locked challenges and anonymous SQL access fail closed", async () => {
  const f = await fixture()
  try {
    const request = browserRequest(), id = challenge(await f.service().signup(request(), input)), code = f.codes.get(input.email)!
    for (let attempt = 0; attempt < 5; attempt++) await assert.rejects(f.service().verifySignup(request(), id, "999999", input.password), { code: "INVALID_VERIFICATION_CODE" })
    await assert.rejects(f.service().verifySignup(request(), id, code, input.password), { code: "INVALID_VERIFICATION_CODE" })
    const next = challenge(await f.service().signup(request(), input))
    await f.db.query("update gethired_private.onboarding_operations set created_at=now()-interval '2 hours', expires_at=now()-interval '1 hour' where id=$1", [next])
    await assert.rejects(f.service().verifySignup(request(), next, f.codes.get(input.email)!, input.password), { code: "INVALID_VERIFICATION_CODE" })
    await f.operator(async () => {
      await f.db.exec("set role anon")
      for (const sql of ["select * from gethired_private.onboarding_operations", `select * from gethired_private.setup_provider_snapshot('${id}')`, "select gethired_private.create_pending_student('87654321@usc.edu.ph','X','Y','BS Computer Science','1st Year')"])
        await assert.rejects(f.db.exec(sql))
      await f.db.exec("reset role; set role gethired_maintenance")
      await f.db.query("select gethired_private.prune_onboarding(100)")
    })
    assert.equal((await f.db.query<{ profile: unknown }>("select profile from gethired_private.onboarding_operations where id=$1", [next])).rows[0].profile, null)
  } finally { await f.close() }
})
