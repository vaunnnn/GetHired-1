import assert from "node:assert/strict"
import { test } from "node:test"
import { readFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { PGlite } from "@electric-sql/pglite"
import { assertPermission, assertOwnedResource } from "../src/authorization/policy.js"
import { createApiRoute } from "../src/api/route.js"
import { ApiError } from "../src/api/errors.js"
import { strictObject, text, optional, uuid, pagination } from "../src/api/validation.js"
import { authorizedTransaction, transaction } from "../src/db/transaction.js"
import { appendAudit, enqueue, claimJobs, finishJob } from "../src/db/events.js"
import { createAuthStore, type SqlClient, type SqlPool } from "../src/auth/store.js"
import type { Principal } from "../src/auth/types.js"

function principal(role: "student" | "admin"): Principal {
  return { id: randomUUID(), user: { id: randomUUID(), role, displayName: "Test", email: "test@example.test", student: null },
    identity: { userId: randomUUID(), sessionId: randomUUID() }, session: {} as Principal["session"] }
}
test("central permissions deny role escalation and never grant administrators student-private access", async () => {
  const student = principal("student")
  const admin = principal("admin")
  assertPermission(student, "companies:read")
  assertPermission(admin, "companies:write")
  assert.throws(() => assertPermission(student, "students:manage"), { code: "FORBIDDEN" })
  assert.throws(() => assertPermission(admin, "interviews:own"), { code: "FORBIDDEN" })
  assertOwnedResource(student, student.id)
  assert.throws(() => assertOwnedResource(student, randomUUID()), { code: "NOT_FOUND" })
  assert.throws(() => assertOwnedResource(student, undefined), { code: "NOT_FOUND" })
  assert.throws(() => assertOwnedResource(admin, admin.id), { code: "FORBIDDEN" })
  for (const permission of [undefined, "unregistered:permission"])
    assert.throws(() => createApiRoute({ route: "/api/private", access: { kind: "protected", permission }, methods: {} } as never), /explicit permission/)
  assert.throws(() => createApiRoute({ route: "/api/admin/students", access: { kind: "public" },
    methods: { GET: { body: "none", handle: () => ({ data: {} }) } } }), /protected permission/)
  let called = false
  const route = createApiRoute({ route: "/api/admin/students", access: { kind: "protected", permission: "students:manage" },
    methods: { GET: { body: "none", handle: () => { called = true; return { data: {} } } } } },
  { config: () => ({ appOrigin: "http://localhost", maxBodyBytes: 65536, logDestination: "stdout" }), logger() {},
    enforceAccess: async () => ({ id: student.id, auth: student }) })
  assert.equal((await route.GET(new Request("http://localhost/api/admin/students"))).status, 403)
  assert.equal(called, false)
})

test("feature validation rejects unknown fields, empty patches, bad UUIDs and ambiguous pagination", () => {
  assert.deepEqual({ ...strictObject({ name: " Example " }, { name: text(1, 30) }) }, { name: "Example" })
  for (const input of [null, [], {}, { name: "Example", role: "admin" }])
    assert.throws(() => strictObject(input, { name: text(1, 30) }), { code: "VALIDATION_ERROR" })
  assert.throws(() => strictObject({}, { name: optional(text(1, 30)) }, true), { code: "VALIDATION_ERROR" })
  assert.throws(() => uuid("1"), { code: "VALIDATION_ERROR" })
  assert.deepEqual(pagination(new URLSearchParams()), { page: 1, pageSize: 20 })
  for (const query of ["page=0", "page=-1", "page=1&page=2", "pageSize=101", "page=1.5", "pageSize=2e1"])
    assert.throws(() => pagination(new URLSearchParams(query)), { code: "VALIDATION_ERROR" })
})

test("B3 migration, authorized atomic writes, append-only audit and leased outbox enforce runtime boundaries", async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, email_confirmed_at timestamptz, banned_until timestamptz);
      create table auth.sessions(id uuid primary key, user_id uuid references auth.users(id), not_after timestamptz);
      create table auth.refresh_tokens(session_id uuid references auth.sessions(id) on delete cascade, revoked boolean);`)
    for (const name of ["202609290001_phase3_auth.sql", "202610050001_b2_operations.sql", "202610120001_b3_feature_foundation.sql"])
      await db.exec(await readFile(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8"))
    const authId = randomUUID(), accountId = randomUUID(), sessionId = randomUUID()
    await db.exec("alter table gethired_private.accounts add column credentials_blocked boolean not null default false; alter table gethired_private.accounts add column credential_version integer not null default 0")
    await db.query("insert into auth.users values ($1, now(), null)", [authId])
    await db.query("insert into auth.sessions values ($1, $2, null)", [sessionId, authId])
    await db.query("insert into auth.refresh_tokens values ($1, false)", [sessionId])
    await db.query("insert into gethired_private.accounts(id,auth_user_id,email,display_name,role,status) values ($1,$2,'test@example.test','Test Admin','admin','active')", [accountId, authId])
    // Embedded PostgreSQL adapter deliberately serializes one connection. Hosted
    // multi-connection lock behavior is a separate staging acceptance check.
    const client = { query: async (sql: string, values?: unknown[]) => {
      const result = await db.query(sql, values)
      return { rows: result.rows, rowCount: result.affectedRows ?? 0 }
    }, release() {} } as SqlClient
    const pool: SqlPool = { connect: async () => client }
    await db.exec("set role gethired_runtime")
    const actor = await createAuthStore(pool).createSession({ userId: authId, sessionId }, false)
    const resourceId = randomUUID(), dedupeKey = randomUUID()
    const event = { actorId: accountId, requestId: randomUUID(), action: "company.created", resourceType: "company", resourceId }
    await authorizedTransaction(pool, actor, "companies:write", async client => {
      await appendAudit(client, event)
      await enqueue(client, { topic: "company.created", resourceId, dedupeKey })
      await enqueue(client, { topic: "company.created", resourceId, dedupeKey })
    })
    for (const sql of ["select * from gethired_private.audit_events", "delete from gethired_private.audit_events",
      "truncate gethired_private.audit_events", "update gethired_private.outbox set attempts = 0",
      "select * from gethired_private.claim_outbox(1)"])
      await assert.rejects(db.exec(sql))
    await assert.rejects(transaction(pool, async client => {
      await appendAudit(client, event)
      await enqueue(client, { topic: "company.created", resourceId, dedupeKey: randomUUID() })
      throw new ApiError("CONFLICT")
    }), { code: "CONFLICT" })
    await db.exec("reset role")
    assert.equal((await db.query("select * from gethired_private.audit_events")).rows.length, 1)
    assert.equal((await db.query("select * from gethired_private.outbox")).rows.length, 1)
    await assert.rejects(db.exec("update gethired_private.audit_events set action='changed'"), /append-only/)
    await assert.rejects(db.exec("truncate gethired_private.audit_events"), /append-only/)

    await db.exec("set role gethired_outbox_worker")
    await assert.rejects(db.exec("select * from gethired_private.accounts"))
    await assert.rejects(claimJobs(client, 0))
    const jobs = await claimJobs(client, 1)
    assert.equal(jobs.length, 1)
    assert.equal((await claimJobs(client, 1)).length, 0)
    assert.equal(await finishJob(client, { ...jobs[0], lease_token: randomUUID() }, true), false)
    assert.equal(await finishJob(client, jobs[0], false), true)
    assert.equal((await claimJobs(client, 1)).length, 0)
    await db.exec("reset role; update gethired_private.outbox set available_at = now() - interval '1 minute'; set role gethired_outbox_worker")
    const retry = (await claimJobs(client, 1))[0]
    assert.equal(retry.attempts, 2)
    assert.equal(await finishJob(client, jobs[0], true), false)
    assert.equal(await finishJob(client, retry, true), true)
    assert.equal((await claimJobs(client, 1)).length, 0)

    // A crashed worker's lease can be reclaimed, but its completion cannot win.
    await db.exec("reset role; set role gethired_runtime")
    await enqueue(client, { topic: "company.updated", resourceId, dedupeKey: randomUUID() })
    await db.exec("reset role; set role gethired_outbox_worker")
    const abandoned = (await claimJobs(client, 1))[0]
    await db.exec("reset role; update gethired_private.outbox set leased_until = now() - interval '1 minute' where completed_at is null; set role gethired_outbox_worker")
    const reclaimed = (await claimJobs(client, 1))[0]
    assert.equal(reclaimed.id, abandoned.id)
    assert.notEqual(reclaimed.lease_token, abandoned.lease_token)
    assert.equal(await finishJob(client, abandoned, true), false)
    await db.exec("reset role; update gethired_private.outbox set attempts = 10, leased_until = now() - interval '1 minute' where completed_at is null; set role gethired_outbox_worker")
    assert.equal((await claimJobs(client, 1)).length, 0)

    await db.exec("reset role; update gethired_private.accounts set status='inactive'; set role gethired_runtime")
    let wrote = false
    await assert.rejects(authorizedTransaction(pool, actor, "companies:write", async () => { wrote = true }), { code: "SESSION_EXPIRED" })
    assert.equal(wrote, false)
    await db.exec("reset role; update gethired_private.accounts set status='active'; set role gethired_runtime")
    await assert.rejects(authorizedTransaction(pool, actor, "companies:write", async () => { wrote = true }), { code: "SESSION_EXPIRED" })
    assert.equal(wrote, false)
  } finally { await db.close() }
})
