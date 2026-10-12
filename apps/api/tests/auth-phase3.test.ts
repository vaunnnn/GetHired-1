import assert from "node:assert/strict"
import { test } from "node:test"
import { readFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { PGlite } from "@electric-sql/pglite"
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose"
import { ApiError } from "../src/api/errors.js"
import { createApiRoute } from "../src/api/route.js"
import { readServerConfig } from "../src/config.js"
import { readAuthConfig } from "../src/auth/config.js"
import { createBrowserSecurity } from "../src/auth/cookies.js"
import { createJwtVerifier } from "../src/auth/jwt.js"
import { loginInput, emptyInput } from "../src/auth/input.js"
import { createProvider, RefreshReplayError } from "../src/auth/provider.js"
import { createAuthService } from "../src/auth/service.js"
import { createAuthStore, type SqlPool } from "../src/auth/store.js"
import {
  sessionPolicy,
  type Identity,
  type Session,
} from "../src/auth/types.js"

const origin = "http://localhost:3000"
const env = {
  AUTH_ENABLED: "true",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  SUPABASE_JWT_ALGORITHMS: "ES256",
  AUTH_COOKIE_SECRET: "ab".repeat(32),
  DATABASE_URL: "postgresql://app:example@localhost/postgres",
}
const config = readAuthConfig(env)
const errorCode = (code: string) => (error: unknown) =>
  error instanceof ApiError && error.code === code

test("authentication configuration fails safely, and disabled auth needs no credentials", () => {
  assert.equal(readAuthConfig({}).enabled, false)
  for (const patch of [
    { SUPABASE_URL: "https://attacker.example" },
    { SUPABASE_JWT_ALGORITHMS: "HS256" },
    { AUTH_COOKIE_SECRET: "secret" },
    { DATABASE_URL: "postgres://app:secret@host/db?sslmode=disable" },
    { NODE_ENV: "production" },
    { AUTH_ENABLED: "yes" },
  ]) {
    assert.throws(
      () => readAuthConfig({ ...env, ...patch }),
      (error) => error instanceof Error && !error.message.includes("secret"),
    )
  }
  assert.equal(
    readAuthConfig({
      ...env,
      NODE_ENV: "production",
      AUTH_TRUSTED_IP_HEADER: "x-verified-ip",
    }).production,
    true,
  )
})

test("JWT verification checks signature, algorithm, issuer, audience, timing, UUID claims, and key outages", async () => {
  const keys = await generateKeyPair("ES256")
  const publicKey = await exportJWK(keys.publicKey)
  const verify = createJwtVerifier(
    config,
    createLocalJWKSet({ keys: [{ ...publicKey, kid: "test", alg: "ES256" }] }),
  )
  const identity = { userId: randomUUID(), sessionId: randomUUID() }
  const now = Math.floor(Date.now() / 1000)
  async function token(overrides = {}, key = keys.privateKey) {
    return new SignJWT({
      sub: identity.userId,
      session_id: identity.sessionId,
      iss: `${config.supabaseUrl}/auth/v1`,
      aud: "authenticated",
      iat: now,
      exp: now + 900,
      ...overrides,
    })
      .setProtectedHeader({
        alg: "ES256",
        kid: "test",
        jku: "https://attacker.invalid/keys",
      })
      .sign(key)
  }
  assert.deepEqual(await verify(await token()), identity)
  for (const claims of [
    { iss: "https://evil.invalid" },
    { aud: "service_role" },
    { sub: "admin" },
    { session_id: "bad" },
    { session_id: undefined },
    { exp: undefined },
    { iat: undefined },
    { nbf: now + 31 },
    { iat: now + 31 },
    { exp: now + 901 },
  ]) {
    await assert.rejects(
      verify(await token(claims)),
      errorCode("UNAUTHENTICATED"),
    )
  }
  await assert.rejects(
    verify(await token({ exp: now - 31 })),
    errorCode("SESSION_EXPIRED"),
  )
  const other = await generateKeyPair("ES256")
  await assert.rejects(
    verify(await token({}, other.privateKey)),
    errorCode("UNAUTHENTICATED"),
  )
  await assert.rejects(verify("not-a-jwt"), errorCode("UNAUTHENTICATED"))
  const symmetric = await new SignJWT({ sub: identity.userId })
    .setProtectedHeader({ alg: "HS256" })
    .sign(new Uint8Array(32))
  await assert.rejects(verify(symmetric), errorCode("UNAUTHENTICATED"))
  const unavailable = createJwtVerifier(config, async () => {
    throw new Error("private provider diagnostics")
  })
  await assert.rejects(
    unavailable(await token()),
    errorCode("SERVICE_UNAVAILABLE"),
  )
})

test("cookies and CSRF bind tokens to a browser and rotate on login", () => {
  const browser = createBrowserSecurity(config, origin)
  const headers = new Headers()
  const binding = browser.issueBinding(headers)
  const cookie = headers.getSetCookie()[0].split(";")[0]
  const csrf = browser.csrfToken(binding)
  const request = (extra: Record<string, string> = {}) =>
    new Request(`${origin}/api/auth/login`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: origin,
        "X-CSRF-Token": csrf,
        ...extra,
      },
    })
  assert.equal(browser.assertMutation(request()).nonce, binding.nonce)
  for (const extra of [
    { Origin: "https://evil.invalid" },
    { Origin: "" },
    { "X-CSRF-Token": "bad" },
    { Cookie: "" },
    { Cookie: `${cookie}; ${cookie}` },
    { "Sec-Fetch-Site": "cross-site" },
  ] as Record<string, string>[])
    assert.throws(
      () => browser.assertMutation(request(extra)),
      errorCode("CSRF_FAILED"),
    )
  const authenticated = new Headers()
  const session: Session = {
    id: randomUUID(),
    accountId: randomUUID(),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
    lastActivityAt: new Date(),
    rememberMe: false,
    revokedAt: null,
  }
  browser.issueBinding(authenticated, session)
  assert.throws(
    () =>
      browser.assertMutation(
        request({ Cookie: authenticated.getSetCookie()[0].split(";")[0] }),
      ),
    errorCode("CSRF_FAILED"),
  )
  const secure = createBrowserSecurity(
    { ...config, production: true },
    "https://gethired.example",
  )
  const production = new Headers()
  secure.setCredentials(production, "access", "refresh", {
    ...session,
    rememberMe: true,
  })
  for (const value of production.getSetCookie()) {
    assert.match(value, /^__Host-gethired-/)
    assert.match(value, /HttpOnly; SameSite=Lax; Secure; Max-Age=\d+/)
    assert.doesNotMatch(value, /Domain=/)
  }
  assert.doesNotMatch(headers.getSetCookie()[0], /Secure|Max-Age|Domain=/)
  browser.clear(headers)
  assert.equal(
    headers.getSetCookie().filter((value) => value.includes("Max-Age=0"))
      .length,
    3,
  )
})

test("auth inputs reject privilege fields and preserve passwords exactly", () => {
  assert.deepEqual(
    loginInput({ identifier: " 12345678 ", password: " p a s s " }),
    { identifier: "12345678", password: " p a s s ", rememberMe: false },
  )
  for (const value of [
    { identifier: "admin", password: "x" },
    { identifier: "12345678", password: "x", role: "admin" },
    { identifier: "12345678", password: "x", rememberMe: "true" },
  ])
    assert.throws(() => loginInput(value), errorCode("VALIDATION_ERROR"))
  assert.throws(
    () => emptyInput({ accountId: randomUUID() }),
    errorCode("VALIDATION_ERROR"),
  )
  assert.equal(sessionPolicy("admin", true).rememberMe, false)
  assert.equal(sessionPolicy("student", true).absoluteMs, 30 * 86400000)
})

test("provider adapter uses password/refresh grants, sanitizes failures, and requests local logout", async () => {
  const requests: {
    url: string
    init?: RequestInit
  }[] = []
  const uid = randomUUID()
  const provider = createProvider(config, (async (url, init) => {
    requests.push({ url: String(url), init })
    return String(url).includes("logout")
      ? new Response(null, { status: 204 })
      : Response.json({
          access_token: "access",
          refresh_token: "refresh",
          user: { id: uid, email_confirmed_at: "2026-01-01" },
        })
  }) as typeof fetch)
  assert.equal(
    (await provider.login("user@example.test", " unchanged ")).userId,
    uid,
  )
  assert.deepEqual(JSON.parse(requests[0].init!.body as string), {
    email: "user@example.test",
    password: " unchanged ",
  })
  await provider.refresh("refresh")
  await provider.logout("access")
  assert.match(requests[1].url, /grant_type=refresh_token$/)
  assert.match(requests[2].url, /logout\?scope=local$/)
  for (const [status, code] of [
    [400, "INVALID_CREDENTIALS"],
    [429, "RATE_LIMITED"],
    [500, "SERVICE_UNAVAILABLE"],
  ] as const) {
    const failing = createProvider(config, (async () =>
      Response.json({ message: "SECRET" }, { status })) as typeof fetch)
    await assert.rejects(failing.login("a", "b"), errorCode(code))
  }
  const replay = createProvider(config, (async () =>
    Response.json({ error_code: "refresh_token_already_used" }, {
      status: 400,
    })) as typeof fetch)
  await assert.rejects(replay.refresh("old"), RefreshReplayError)
})

test("Phase 3 database and authentication lifecycle", async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, email_confirmed_at timestamptz, banned_until timestamptz);
    create table auth.sessions(id uuid primary key, user_id uuid not null references auth.users(id), not_after timestamptz);
    create table auth.refresh_tokens(id bigint generated always as identity primary key, session_id uuid references auth.sessions(id) on delete cascade, revoked boolean not null default false);`)
  await db.exec(
    await readFile(
      new URL(
        "../../../supabase/migrations/202609290001_phase3_auth.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  )
  // PGlite has one connection; serialize transactions and execute as the restricted runtime.
  let queue = Promise.resolve()
  const pool: SqlPool = {
    async connect() {
      const prior = queue
      let release = () => {}
      queue = new Promise<void>((resolve) => {
        release = resolve
      })
      await prior
      return {
        async query(sql, values) {
          const result = await db.query(sql, values)
          if (sql === "begin") await db.exec("set local role gethired_runtime")
          return {
            rows: result.rows as never[],
            rowCount: result.affectedRows ?? null,
          }
        },
        release,
      }
    },
  }
  const store = createAuthStore(pool)
  const student = randomUUID(),
    admin = randomUUID(),
    studentAccount = randomUUID(),
    adminAccount = randomUUID()
  await db.query(
    "insert into auth.users(id, email_confirmed_at) values ($1, now()), ($2, now())",
    [student, admin],
  )
  await db.query(
    `insert into gethired_private.accounts(id, auth_user_id, email, display_name, role, status) values
    ($1, $2, 'student@example.test', 'Student', 'student', 'active'), ($3, $4, 'admin@example.test', 'Admin', 'admin', 'active')`,
    [studentAccount, student, adminAccount, admin],
  )
  await db.query(
    "insert into gethired_private.student_profiles values ($1, '12345678', 'First', 'Last', 'BSCS', '4')",
    [studentAccount],
  )
  const keys = await generateKeyPair("ES256")
  const verifier = createJwtVerifier(
    config,
    createLocalJWKSet({
      keys: [
        { ...(await exportJWK(keys.publicKey)), kid: "fixture", alg: "ES256" },
      ],
    }),
  )
  async function tokens(identity: Identity) {
    const now = Math.floor(Date.now() / 1000)
    return {
      accessToken: await new SignJWT({
        sub: identity.userId,
        session_id: identity.sessionId,
      })
        .setProtectedHeader({ alg: "ES256", kid: "fixture" })
        .setIssuer(`${config.supabaseUrl}/auth/v1`)
        .setAudience("authenticated")
        .setIssuedAt(now)
        .setExpirationTime(now + 900)
        .sign(keys.privateKey),
      refreshToken: identity.sessionId,
      userId: identity.userId,
      emailVerified: true,
    }
  }
  let identity: Identity
  let mode: "normal" | "replay" | "unavailable" | "mismatch" = "normal"
  let logoutUnavailable = false
  let activeRefreshes = 0,
    maxRefreshes = 0
  const provider = {
    async login(email: string, password: string) {
      if (
        password !== " correct password " ||
        !["student@example.test", "admin@example.test"].includes(email)
      )
        throw new ApiError("INVALID_CREDENTIALS")
      identity = {
        userId: email.startsWith("student") ? student : admin,
        sessionId: randomUUID(),
      }
      await db.query("insert into auth.sessions values ($1, $2, null)", [
        identity.sessionId,
        identity.userId,
      ])
      await db.query(
        "insert into auth.refresh_tokens(session_id) values ($1)",
        [identity.sessionId],
      )
      return tokens(identity)
    },
    async refresh(refreshToken: string) {
      activeRefreshes++
      maxRefreshes = Math.max(maxRefreshes, activeRefreshes)
      try {
        if (mode === "replay") throw new RefreshReplayError()
        if (mode === "unavailable") throw new ApiError("SERVICE_UNAVAILABLE")
        return tokens({
          userId: mode === "mismatch" ? admin : student,
          sessionId: refreshToken,
        })
      } finally {
        activeRefreshes--
      }
    },
    async logout(access: string) {
      if (logoutUnavailable) throw new ApiError("SERVICE_UNAVAILABLE")
      const verified = await verifier(access)
      await db.query("delete from auth.sessions where id = $1", [
        verified.sessionId,
      ])
    },
  }
  const service = createAuthService({
    config,
    appOrigin: origin,
    store,
    provider,
    verify: verifier,
  })
  const jar = new Map<string, string>()
  let csrf = ""
  function apply(headers?: HeadersInit) {
    for (const line of new Headers(headers).getSetCookie()) {
      const [pair] = line.split(";")
      const index = pair.indexOf("=")
      if (line.includes("Max-Age=0")) jar.delete(pair.slice(0, index))
      else jar.set(pair.slice(0, index), pair.slice(index + 1))
    }
  }
  function request(method = "POST", extra: Record<string, string> = {}) {
    return new Request(`${origin}/api/auth/test`, {
      method,
      headers: {
        Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join("; "),
        Origin: origin,
        "X-CSRF-Token": csrf,
        ...extra,
      },
    })
  }
  function getCsrf() {
    const result = service.csrf(request("GET"))
    apply(result.headers)
    csrf = (result.data as { csrfToken: string }).csrfToken
  }
  async function login(rememberMe = false, identifier = "12345678") {
    getCsrf()
    const result = await service.login(request(), {
      identifier,
      password: " correct password ",
      rememberMe,
    })
    apply(result.headers)
    getCsrf()
    return result
  }

  await t.test(
    "migration hides app tables and privileged operations from Data API and runtime",
    async () => {
      const grants = await db.query<{ allowed: boolean }>(
        "select has_schema_privilege('anon', 'gethired_private', 'usage') as allowed",
      )
      assert.equal(grants.rows[0].allowed, false)
      const privileged = await db.query<{ allowed: boolean }>(
        "select has_function_privilege('gethired_runtime', 'gethired_private.process_provider_cleanup(integer)', 'execute') as allowed",
      )
      assert.equal(privileged.rows[0].allowed, false)
      assert.equal(
        (
          await db.query<{ allowed: boolean }>(
            "select has_table_privilege('gethired_runtime', 'gethired_private.accounts', 'update') as allowed",
          )
        ).rows[0].allowed,
        false,
      )
    },
  )
  await t.test(
    "login maps real identity to the safe profile; me and refresh do not extend activity",
    async () => {
      const result = await login()
      const data = result.data as {
        user: {
          id: string
          role: string
        }
        session: { rememberMe: boolean }
      }
      assert.equal(data.user.id, studentAccount)
      assert.equal(data.user.role, "student")
      assert.equal(data.session.rememberMe, false)
      assert.doesNotMatch(
        JSON.stringify(result.data),
        /accessToken|refreshToken|password|session_id/,
      )
      assert.equal(new Headers(result.headers).getSetCookie().length, 3)
      assert.ok(
        new Headers(result.headers)
          .getSetCookie()
          .every((value) => !value.includes("Max-Age")),
      )
      const principal = await service.authenticate(request("GET"))
      assert.equal(
        principal.session.expiresAt.getTime() -
          principal.session.createdAt.getTime(),
        8 * 3600000,
      )
      const refresh = await service.refresh(request(), {})
      apply(refresh.headers)
      const after = await service.authenticate(request("GET"))
      assert.equal(
        after.session.expiresAt.getTime(),
        principal.session.expiresAt.getTime(),
      )
      assert.equal(
        after.session.lastActivityAt.getTime(),
        principal.session.lastActivityAt.getTime(),
      )
    },
  )
  await t.test(
    "refresh works without an access JWT, rejects mismatched identity, and preserves outages",
    async () => {
      jar.delete(service.browser.names.access)
      apply((await service.refresh(request(), {})).headers)
      mode = "mismatch"
      await assert.rejects(
        service.refresh(request(), {}),
        errorCode("UNAUTHENTICATED"),
      )
      mode = "unavailable"
      await assert.rejects(
        service.refresh(request(), {}),
        errorCode("SERVICE_UNAVAILABLE"),
      )
      mode = "normal"
      await service.authenticate(request("GET"))
    },
  )
  await t.test(
    "concurrent refreshes succeed without inventing replay and confirmed replay commits revocation",
    async () => {
      await Promise.all([
        service.refresh(request(), {}),
        service.refresh(request(), {}),
      ])
      assert.equal(maxRefreshes, 1)
      mode = "replay"
      await assert.rejects(
        service.refresh(request(), {}),
        errorCode("SESSION_EXPIRED"),
      )
      mode = "normal"
      await assert.rejects(
        service.authenticate(request("GET")),
        errorCode("SESSION_EXPIRED"),
      )
      assert.equal(
        (
          await db.query(
            "select * from gethired_private.provider_cleanup where session_id = $1",
            [identity!.sessionId],
          )
        ).rows.length,
        1,
      )
    },
  )
  await t.test(
    "remembered student sessions last 30 days, administrators ignore remember me",
    async () => {
      const remembered = await login(true)
      assert.ok(
        new Headers(remembered.headers)
          .getSetCookie()
          .every((value) => value.includes("Max-Age=")),
      )
      const principal = await service.authenticate(request("GET"))
      assert.equal(
        principal.session.expiresAt.getTime() -
          principal.session.createdAt.getTime(),
        30 * 86400000,
      )
      const result = await login(true, "admin@example.test")
      assert.equal(
        (result.data as { session: { rememberMe: boolean } }).session
          .rememberMe,
        false,
      )
      assert.ok(
        new Headers(result.headers)
          .getSetCookie()
          .every((value) => !value.includes("Max-Age")),
      )
    },
  )
  await t.test(
    "idle and absolute expiry block access and refresh; only explicit business activity touches idle",
    async () => {
      await login()
      await db.query(
        "update gethired_private.sessions set last_activity_at = now() - interval '29 minutes' where id = $1",
        [identity!.sessionId],
      )
      const principal = await service.authenticate(request("GET"))
      await service.recordActivity(principal)
      assert.ok(
        (await service.authenticate(request("GET"))).session.lastActivityAt >
          principal.session.lastActivityAt,
      )
      await db.query(
        "update gethired_private.sessions set last_activity_at = now() - interval '31 minutes' where id = $1",
        [identity!.sessionId],
      )
      await assert.rejects(
        service.authenticate(request("GET")),
        errorCode("SESSION_EXPIRED"),
      )
      await assert.rejects(
        service.refresh(request(), {}),
        errorCode("SESSION_EXPIRED"),
      )
      await login()
      await db.query(
        "update gethired_private.sessions set created_at = now() - interval '9 hours', expires_at = now() - interval '1 hour' where id = $1",
        [identity!.sessionId],
      )
      await assert.rejects(
        service.authenticate(request("GET")),
        errorCode("SESSION_EXPIRED"),
      )
    },
  )
  await t.test(
    "deactivation, reactivation, role change, provider logout, and reset revocation invalidate sessions",
    async () => {
      await login()
      await db.query(
        "update gethired_private.accounts set status = 'inactive' where id = $1",
        [studentAccount],
      )
      await assert.rejects(
        service.authenticate(request("GET")),
        errorCode("SESSION_EXPIRED"),
      )
      await db.query(
        "update gethired_private.accounts set status = 'active' where id = $1",
        [studentAccount],
      )
      await assert.rejects(
        service.authenticate(request("GET")),
        errorCode("SESSION_EXPIRED"),
      )
      await login()
      await db.query(
        "update gethired_private.accounts set role = 'admin' where id = $1",
        [studentAccount],
      )
      await assert.rejects(
        service.authenticate(request("GET")),
        errorCode("SESSION_EXPIRED"),
      )
      await db.query(
        "update gethired_private.accounts set role = 'student' where id = $1",
        [studentAccount],
      )
      await login()
      await db.query("delete from auth.sessions where id = $1", [
        identity!.sessionId,
      ])
      await assert.rejects(
        service.authenticate(request("GET")),
        errorCode("SESSION_EXPIRED"),
      )
      await login()
      await service.revokeAll(studentAccount)
      await assert.rejects(
        service.authenticate(request("GET")),
        errorCode("SESSION_EXPIRED"),
      )
    },
  )
  await t.test(
    "logout revokes before clearing cookies, preserves other devices, and queues failed provider cleanup",
    async () => {
      await login()
      const otherSession = identity!.sessionId
      await login()
      const loggedOut = identity!.sessionId
      logoutUnavailable = true
      const result = await service.logout(request(), {})
      assert.deepEqual(result.data, { loggedOut: true })
      await assert.rejects(
        service.authenticate(request("GET")),
        errorCode("SESSION_EXPIRED"),
      )
      assert.equal(
        (
          await db.query<{ revoked_at: Date | null }>(
            "select revoked_at from gethired_private.sessions where id = $1",
            [otherSession],
          )
        ).rows[0].revoked_at,
        null,
      )
      const queued = await db.query<{ completed_at: Date | null }>(
        "select completed_at from gethired_private.provider_cleanup where session_id = $1",
        [loggedOut],
      )
      assert.equal(queued.rows[0].completed_at, null)
      await db.query("select gethired_private.process_provider_cleanup()")
      assert.equal(
        (
          await db.query("select id from auth.sessions where id = $1", [
            loggedOut,
          ])
        ).rows.length,
        0,
      )
      assert.equal(
        (
          await db.query("select id from auth.sessions where id = $1", [
            otherSession,
          ])
        ).rows.length,
        1,
      )
      apply(result.headers)
      getCsrf()
      assert.deepEqual((await service.logout(request(), {})).data, {
        loggedOut: true,
      })
      logoutUnavailable = false
    },
  )
  await t.test(
    "logout can revoke with no access cookie and never succeeds when local revocation fails",
    async () => {
      await login()
      jar.delete(service.browser.names.access)
      const failing = createAuthService({
        config,
        appOrigin: origin,
        provider,
        verify: verifier,
        store: {
          ...store,
          revokeSession: async () => {
            throw new ApiError("SERVICE_UNAVAILABLE")
          },
        },
      })
      await assert.rejects(
        failing.logout(request(), {}),
        errorCode("SERVICE_UNAVAILABLE"),
      )
      apply((await service.logout(request(), {})).headers)
      assert.equal(jar.size, 0)
    },
  )
  await t.test(
    "invalid login states share one error and distributed counters enforce retry windows",
    async () => {
      getCsrf()
      for (let attempt = 0; attempt < 5; attempt++)
        await assert.rejects(
          service.login(request(), {
            identifier: "unknown@example.test",
            password: "wrong",
          }),
          errorCode("INVALID_CREDENTIALS"),
        )
      await assert.rejects(
        service.login(request(), {
          identifier: "unknown@example.test",
          password: "wrong",
        }),
        errorCode("RATE_LIMITED"),
      )
      await db.query(
        "update gethired_private.accounts set status = 'inactive' where id = $1",
        [studentAccount],
      )
      await assert.rejects(
        service.login(request(), {
          identifier: "12345678",
          password: " correct password ",
        }),
        errorCode("INVALID_CREDENTIALS"),
      )
      await db.query(
        "update gethired_private.accounts set status = 'active' where id = $1",
        [studentAccount],
      )
      const key = "independent-limit-test"
      await store.consumeLimit(key, 1, 60)
      await assert.rejects(
        store.consumeLimit(key, 1, 60),
        (error) =>
          error instanceof ApiError &&
          error.code === "RATE_LIMITED" &&
          Number(error.headers.get("Retry-After")) > 0,
      )
      await db.query(
        "update gethired_private.auth_limits set expires_at = now() - interval '1 second' where key = $1",
        [key],
      )
      await store.consumeLimit(key, 1, 60)
    },
  )
  await t.test(
    "wrapper rejects CSRF before authentication and retains safe JSON/logging contracts",
    async () => {
      let handled = false
      const logs: unknown[] = []
      const route = createApiRoute(
        {
          route: "/api/auth/test",
          access: { kind: "protected", permission: "session:read" },
          methods: {
            POST: {
              body: "json",
              handle: () => {
                handled = true
                return { data: {} }
              },
            },
          },
        },
        {
          config: () => readServerConfig({ APP_ORIGIN: origin }),
          logger: (record) => {
            logs.push(record)
          },
          enforceBrowserProtection: (request) => {
            service.browser.assertMutation(request)
          },
          enforceAccess: async (request) => ({
            id: (await service.authenticate(request)).id,
          }),
        },
      )
      const response = await route.POST(
        new Request(`${origin}/api/auth/test`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "https://evil.invalid",
            Cookie: "access=SECRET",
          },
          body: "{}",
        }),
      )
      assert.equal(response.status, 403)
      assert.equal((await response.json()).error.code, "CSRF_FAILED")
      assert.equal(response.headers.get("Cache-Control"), "private, no-store")
      assert.equal(handled, false)
      assert.doesNotMatch(JSON.stringify(logs), /SECRET|evil.invalid/)
    },
  )
})
