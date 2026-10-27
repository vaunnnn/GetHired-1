import assert from "node:assert/strict"
import { test } from "node:test"
import { readFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { PGlite } from "@electric-sql/pglite"
import {
  createAuthStore,
  type SqlPool,
  type SqlClient,
} from "../src/auth/store.js"
import { createAuthService } from "../src/auth/service.js"
import type { AuthConfig } from "../src/auth/config.js"
import { createApiRoute } from "../src/api/route.js"
import { ApiError } from "../src/api/errors.js"
import {
  authorizedTransaction,
  type AuthorizationTransaction,
} from "../src/db/transaction.js"
import { createCompanyRepository } from "../src/modules/companies/repository.js"
import { companyQuery } from "../src/modules/companies/validation.js"
import { providerSchema, migrations } from "./support/phase2-database.js"
import type { Permission } from "../src/authorization/policy.js"
import type { Principal } from "../src/auth/types.js"

test("Phase 2 authorization and route transaction boundaries", async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(providerSchema)
  for (const name of migrations)
    await db.exec(
      await readFile(
        new URL(`../../../supabase/migrations/${name}`, import.meta.url),
        "utf8",
      ),
    )
  let statements: string[] = []
  const client = {
    async query(sql: string, values?: unknown[]) {
      statements.push(sql)
      const result = await db.query(sql, values)
      if (sql === "begin") await db.exec("set local role gethired_runtime")
      return { rows: result.rows, rowCount: result.affectedRows ?? 0 }
    },
    release() {},
  } as SqlClient
  const pool: SqlPool = {
    async connect() {
      return client
    },
  }
  const store = createAuthStore(pool),
    repo = createCompanyRepository(pool)
  const config: AuthConfig = {
    enabled: true,
    production: false,
    algorithms: ["ES256"],
    cookieSecret: "ab".repeat(32),
    databaseUrl: "",
    supabaseUrl: "https://test.supabase.co",
    publishableKey: "test",
  }
  const tokenOwners = new Map<string, Principal["identity"]>()
  const service = createAuthService({
    config,
    appOrigin: "http://localhost:3000",
    store,
    async verify(token) {
      const identity = tokenOwners.get(token)
      if (!identity) throw new ApiError("UNAUTHENTICATED")
      return identity
    },
    provider: {
      async login() {
        assert.fail("unexpected provider login")
      },
      async refresh() {
        assert.fail("unexpected provider refresh")
      },
      async logout() {
        assert.fail("unexpected provider logout")
      },
    },
  })
  async function actor(role: "student" | "admin") {
    const id = randomUUID(),
      identity = { userId: randomUUID(), sessionId: randomUUID() }
    await db.query(
      "insert into auth.users(id,email_confirmed_at) values ($1,now())",
      [identity.userId],
    )
    await db.query("insert into auth.sessions values ($1,$2,null)", [
      identity.sessionId,
      identity.userId,
    ])
    await db.query("insert into auth.refresh_tokens values ($1,false)", [
      identity.sessionId,
    ])
    await db.query(
      "insert into gethired_private.accounts(id,auth_user_id,email,display_name,role,status) values ($1,$2,$3,'Test',$4,'active')",
      [id, identity.userId, `${id}@example.test`, role],
    )
    if (role === "student")
      await db.query(
        "insert into gethired_private.student_profiles values ($1,$2,'Test','Student','BSCS','4')",
        [id, id.replace(/\D/g, "").slice(0, 8).padEnd(8, "0")],
      )
    const principal = await store.createSession(identity, false)
    tokenOwners.set(id, identity)
    const headers = new Headers()
    service.browser.setCredentials(
      headers,
      id,
      "fixture-refresh",
      principal.session,
    )
    const binding = service.browser.issueBinding(headers, principal.session)
    const request = (method = "GET", body?: string) =>
      new Request("http://localhost:3000/api/example", {
        method,
        headers: {
          cookie: headers
            .getSetCookie()
            .map((value) => value.split(";")[0])
            .join("; "),
          origin: "http://localhost:3000",
          "x-csrf-token": service.browser.csrfToken(binding),
          "content-type": "application/json",
        },
        ...(body === undefined ? {} : { body }),
      })
    return { principal, request }
  }
  const admin = await actor("admin"),
    student = await actor("student"),
    other = await actor("student")
  const dependencies = {
    config: () => ({
      appOrigin: "http://localhost:3000",
      maxBodyBytes: 65536,
      logDestination: "stdout" as const,
    }),
    logger() {},
    enforceBrowserProtection: (request: Request) => {
      service.browser.assertMutation(request)
    },
    withAuthorization: service.withAuthorization,
  }
  const route = (
    permission: Permission,
    handle: Parameters<typeof createApiRoute>[0]["methods"]["GET"],
    method: "GET" | "POST" = "GET",
  ) =>
    createApiRoute(
      {
        route: "/api/example",
        access: { kind: "protected", permission, transaction: "business" },
        methods: { [method]: handle },
      },
      dependencies,
    )

  await t.test(
    "session projection takes four SQL calls, rejects mismatched binding, and never touches idle activity",
    async () => {
      statements = []
      const current = await service.authenticate(student.request())
      assert.equal(statements.length, 4)
      assert.equal(
        current.session.lastActivityAt.getTime(),
        student.principal.session.lastActivityAt.getTime(),
      )
      tokenOwners.set(student.principal.id, other.principal.identity)
      await assert.rejects(service.authenticate(student.request()), {
        code: "UNAUTHENTICATED",
      })
      tokenOwners.set(student.principal.id, student.principal.identity)
    },
  )

  await t.test(
    "both roles list companies with six calls, one transaction and deliberate activity",
    async () => {
      for (const owner of [admin, student]) {
        const isAdmin = owner === admin
        await db.query(
          "update gethired_private.sessions set last_activity_at = now() - interval '1 minute' where id = $1",
          [owner.principal.session.id],
        )
        const before = await store.readSession(
          owner.principal.session.id,
          owner.principal.identity,
        )
        const handlers = route(isAdmin ? "companies:write" : "companies:read", {
          body: "none",
          handle: (context) =>
            repo.list(
              context.actor!.auth!,
              companyQuery(new URLSearchParams(), isAdmin),
              isAdmin,
              false,
              context.authorization,
            ),
        })
        statements = []
        const response = await handlers.GET(owner.request())
        assert.equal(response.status, 200)
        assert.equal(statements.length, 6)
        assert.equal(statements.filter((sql) => sql === "begin").length, 1)
        assert.equal(
          statements.filter((sql) => sql.includes("authorize_session")).length,
          2,
        )
        assert.ok(
          (
            await store.readSession(
              owner.principal.session.id,
              owner.principal.identity,
            )
          ).session.lastActivityAt > before.session.lastActivityAt,
        )
      }
    },
  )

  await t.test(
    "route permissions deny before body parsing and all handler/database work",
    async () => {
      let called = false
      const handlers = route(
        "students:manage",
        {
          body: "json",
          handle: () => {
            called = true
            return { data: {} }
          },
        },
        "POST",
      )
      const response = await handlers.POST(
        student.request("POST", "{malformed"),
      )
      assert.equal(response.status, 403)
      assert.equal(called, false)
    },
  )

  await t.test(
    "serialization failures roll back business writes and activity",
    async () => {
      const own = await store.readSession(
          admin.principal.session.id,
          admin.principal.identity,
        ),
        companyId = randomUUID()
      const handlers = route(
        "companies:write",
        {
          body: "json",
          handle: async (context) => {
            await context.authorization!.client.query(
              "insert into gethired_private.companies(id,name,industry,type,specializations,location,slots,description,website,email,phone,hours) values ($1,'Rollback','Software','Services',array['Web'],'Cebu',0,'Test','','','','')",
              [companyId],
            )
            return { data: BigInt(1) }
          },
        },
        "POST",
      )
      assert.equal(
        (await handlers.POST(admin.request("POST", "{}"))).status,
        500,
      )
      assert.equal(
        (
          await db.query(
            "select id from gethired_private.companies where id = $1",
            [companyId],
          )
        ).rows.length,
        0,
      )
      assert.equal(
        (
          await store.readSession(own.session.id, own.identity)
        ).session.lastActivityAt.getTime(),
        own.session.lastActivityAt.getTime(),
      )
    },
  )

  await t.test(
    "repository reuse enforces permission, account, pool and callback lifetime",
    async () => {
      let expired: AuthorizationTransaction | undefined,
        verified: Principal | undefined
      await store.withAuthorization(
        student.principal.session.id,
        student.principal.identity,
        "companies:read",
        async (principal, authorization) => {
          expired = authorization
          verified = principal
          await assert.rejects(
            authorizedTransaction(
              pool,
              principal,
              "companies:write",
              async () => assert.fail(),
              authorization,
            ),
            { code: "FORBIDDEN" },
          )
          await assert.rejects(
            authorizedTransaction(
              pool,
              other.principal,
              "companies:read",
              async () => assert.fail(),
              authorization,
            ),
            { code: "SERVICE_UNAVAILABLE" },
          )
          await assert.rejects(
            authorizedTransaction(
              { connect: pool.connect },
              principal,
              "companies:read",
              async () => assert.fail(),
              authorization,
            ),
            { code: "SERVICE_UNAVAILABLE" },
          )
        },
      )
      await assert.rejects(
        authorizedTransaction(
          pool,
          verified!,
          "companies:read",
          async () => assert.fail(),
          expired,
        ),
        { code: "SERVICE_UNAVAILABLE" },
      )
    },
  )

  await t.test(
    "the SQL authorization function is unavailable to public roles and stays an invoker function",
    async () => {
      for (const role of ["anon", "authenticated"]) {
        await db.exec(`set role ${role}`)
        await assert.rejects(
          db.query(
            "select gethired_private.authorize_session($1,$2,true,false)",
            [admin.principal.session.id, admin.principal.identity.userId],
          ),
        )
        await db.exec("reset role")
      }
      const result = await db.query<{ prosecdef: boolean }>(
        "select prosecdef from pg_proc where oid = 'gethired_private.authorize_session(uuid,uuid,boolean,boolean)'::regprocedure",
      )
      assert.equal(result.rows[0].prosecdef, false)
    },
  )
})
