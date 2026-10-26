// Destructive setup/teardown is confined to a new, uniquely named LOCAL test database.
// Start the documented disposable PostgreSQL container; never point this at production.
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { setTimeout as delay } from "node:timers/promises"
import { Pool, type PoolClient } from "pg"
import { createAuthStore } from "../apps/api/src/auth/store.js"
import { authorizeSession } from "../apps/api/src/db/authorization.js"
import {
  sessionTransaction,
  transaction,
} from "../apps/api/src/db/transaction.js"
import { ApiError } from "../apps/api/src/api/errors.js"
import {
  providerSchema,
  migrations,
} from "../apps/api/tests/support/phase2-database.js"

const target = new URL(
  process.env.PHASE2_POSTGRES_URL ??
    "postgresql://postgres@127.0.0.1:55432/postgres",
)
assert.ok(
  ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname),
  "Only a local disposable PostgreSQL instance is allowed",
)
const name = `gethired_phase2_${randomUUID().replaceAll("-", "")}`
const admin = new Pool({
  connectionString: target.toString(),
  connectionTimeoutMillis: 3000,
})
let operator: Pool | undefined, runtime: Pool | undefined
const checks: string[] = []
const gate = () => {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}
async function within<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), 3000)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
async function blocked(pid: number) {
  const deadline = Date.now() + 2500
  while (Date.now() < deadline) {
    const result = await operator!.query(
      "select wait_event_type from pg_stat_activity where pid = $1",
      [pid],
    )
    if (result.rows[0]?.wait_event_type === "Lock") return
    await delay(10)
  }
  assert.fail("Expected PostgreSQL to report a lock wait")
}
async function runtimeBlocked() {
  const deadline = Date.now() + 2500
  while (Date.now() < deadline) {
    const result = await operator!.query(
      "select count(*)::int as n from pg_stat_activity where application_name = 'gethired-phase2-runtime' and wait_event_type = 'Lock'",
    )
    if (result.rows[0].n > 0) return
    await delay(10)
  }
  assert.fail(
    "Expected a runtime authorization to be waiting on a real PostgreSQL lock",
  )
}
async function actor(role: "admin" | "student" = "admin") {
  const identity = { userId: randomUUID(), sessionId: randomUUID() },
    id = randomUUID()
  await operator!.query(
    "insert into auth.users(id,email,email_confirmed_at) values ($1,$2,clock_timestamp())",
    [identity.userId, `${id}@example.test`],
  )
  await operator!.query("insert into auth.sessions values ($1,$2,null)", [
    identity.sessionId,
    identity.userId,
  ])
  await operator!.query("insert into auth.refresh_tokens values ($1,false)", [
    identity.sessionId,
  ])
  await operator!.query(
    "insert into gethired_private.accounts(id,auth_user_id,email,display_name,role,status) values ($1,$2,$3,'Audit',$4,'active')",
    [id, identity.userId, `${id}@example.test`, role],
  )
  if (role === "student")
    await operator!.query(
      "insert into gethired_private.student_profiles values ($1,$2,'Audit','Student','BSCS','4')",
      [id, id.replace(/\D/g, "").slice(0, 8).padEnd(8, "0")],
    )
  return createAuthStore(runtime!).createSession(identity, false)
}
async function run(label: string, work: () => Promise<void>) {
  await work()
  checks.push(label)
  console.log(`PASS: ${label}`)
}
try {
  await admin.query(`create database ${name}`)
  target.pathname = `/${name}`
  operator = new Pool({
    connectionString: target.toString(),
    max: 5,
    connectionTimeoutMillis: 3000,
  })
  await operator.query(providerSchema)
  for (const migration of migrations)
    await operator.query(
      await readFile(`supabase/migrations/${migration}`, "utf8"),
    )
  runtime = new Pool({
    connectionString: target.toString(),
    options: "-c role=gethired_runtime",
    application_name: "gethired-phase2-runtime",
    max: 8,
    connectionTimeoutMillis: 3000,
  })
  const store = createAuthStore(runtime)

  await run(
    "shared session reads overlap; revocation waits and invalidates later reads",
    async () => {
      const own = await actor(),
        hold = gate(),
        firstReady = gate(),
        secondReady = gate()
      const poll = (ready: ReturnType<typeof gate>) =>
        transaction(runtime!, async (client) => {
          await authorizeSession(client, own.session.id, own.identity, {
            shared: true,
          })
          ready.release()
          await hold.promise
        })
      const first = poll(firstReady),
        second = firstReady.promise.then(() => poll(secondReady))
      let writer: PoolClient | undefined
      try {
        await within(
          secondReady.promise,
          "shared read serialized behind another shared read",
        )
        writer = await operator!.connect()
        const pid = (await writer.query("select pg_backend_pid() as pid"))
          .rows[0].pid
        const revoking = writer.query(
          "update gethired_private.sessions set revoked_at = clock_timestamp() where id = $1",
          [own.session.id],
        )
        await blocked(pid)
        hold.release()
        await Promise.all([first, second, revoking])
        await assert.rejects(store.readSession(own.session.id, own.identity), {
          code: "SESSION_EXPIRED",
        })
      } finally {
        hold.release()
        await Promise.allSettled([first, second])
        writer?.release()
      }
    },
  )

  for (const change of [
    "deactivation",
    "role change",
    "credential barrier",
  ] as const)
    await run(
      `${change} waits for polling and denies subsequent authorization`,
      async () => {
        const own = await actor(),
          ready = gate(),
          hold = gate()
        const polling = transaction(runtime!, async (client) => {
          await authorizeSession(client, own.session.id, own.identity, {
            shared: true,
          })
          ready.release()
          await hold.promise
        })
        const writer = await operator!.connect()
        try {
          await within(ready.promise, "polling did not acquire locks")
          const pid = (await writer.query("select pg_backend_pid() as pid"))
            .rows[0].pid
          const update =
            change === "deactivation"
              ? "status = 'inactive'"
              : change === "role change"
                ? "role = 'student'"
                : "credentials_blocked = true"
          const changing = writer.query(
            `update gethired_private.accounts set ${update} where id = $1`,
            [own.id],
          )
          await blocked(pid)
          hold.release()
          await Promise.all([polling, changing])
          await assert.rejects(
            store.readSession(own.session.id, own.identity),
            { code: "SESSION_EXPIRED" },
          )
          if (change === "deactivation") {
            await operator!.query(
              "update gethired_private.accounts set status = 'active' where id = $1",
              [own.id],
            )
            await assert.rejects(
              store.readSession(own.session.id, own.identity),
              { code: "SESSION_EXPIRED" },
            )
          }
        } finally {
          hold.release()
          await Promise.allSettled([polling])
          writer.release()
        }
      },
    )

  await run(
    "refresh callbacks remain exclusive across independent connections",
    async () => {
      const own = await actor(),
        ready = gate(),
        hold = gate()
      let active = 0,
        max = 0,
        secondEntered = false
      const refresh = (first: boolean) =>
        store.withSession(own.session.id, null, false, async () => {
          active++
          max = Math.max(max, active)
          try {
            if (first) {
              ready.release()
              await hold.promise
            } else secondEntered = true
          } finally {
            active--
          }
        })
      const first = refresh(true)
      await within(ready.promise, "first refresh did not start")
      const second = refresh(false)
      try {
        // Observe the wait in PostgreSQL, rather than infer it from a timed sleep.
        await runtimeBlocked()
        assert.equal(secondEntered, false)
        hold.release()
        await Promise.all([first, second])
        assert.equal(max, 1)
        assert.equal(secondEntered, true)
      } finally {
        hold.release()
        await Promise.allSettled([first, second])
      }
    },
  )

  for (const expiry of ["absolute", "idle"] as const)
    await run(
      `${expiry} expiry is evaluated after a real session-row lock wait`,
      async () => {
        const own = await actor(),
          locker = await operator!.connect()
        await operator!.query(
          expiry === "absolute"
            ? "update gethired_private.sessions set expires_at = clock_timestamp() + interval '300 milliseconds' where id = $1"
            : "update gethired_private.sessions set last_activity_at = clock_timestamp() - interval '30 minutes' + interval '300 milliseconds' where id = $1",
          [own.session.id],
        )
        try {
          await locker.query("begin")
          await locker.query(
            "select id from gethired_private.sessions where id = $1 for update",
            [own.session.id],
          )
          const reading = assert.rejects(
            store.readSession(own.session.id, own.identity),
            { code: "SESSION_EXPIRED" },
          )
          await runtimeBlocked()
          await locker.query("select pg_sleep(0.4)")
          await locker.query("commit")
          await reading
        } finally {
          await locker.query("rollback")
          locker.release()
        }
      },
    )

  for (const expiry of ["absolute", "idle"] as const) await run(`post-callback authorization rejects ${expiry} application expiry`, async () => {
    const own = await actor()
    await operator!.query(expiry === "absolute"
      ? "update gethired_private.sessions set expires_at = clock_timestamp() + interval '200 milliseconds' where id = $1"
      : "update gethired_private.sessions set last_activity_at = clock_timestamp() - interval '30 minutes' + interval '200 milliseconds' where id = $1", [own.session.id])
    await assert.rejects(store.withSession(own.session.id, null, false, async () => { await delay(300) }), { code: "SESSION_EXPIRED" })
  })

  await run(
    "post-callback DB clock rejects provider-session expiry without extending activity",
    async () => {
      const own = await actor()
      await operator!.query(
        "update auth.sessions set not_after = clock_timestamp() + interval '200 milliseconds' where id = $1",
        [own.session.id],
      )
      await assert.rejects(
        store.withSession(own.session.id, null, false, async () => {
          await delay(300)
        }),
        { code: "SESSION_EXPIRED" },
      )
      const state = await operator!.query(
        "select last_activity_at from gethired_private.sessions where id = $1",
        [own.session.id],
      )
      assert.equal(
        state.rows[0].last_activity_at.getTime(),
        own.session.lastActivityAt.getTime(),
      )
    },
  )

  await run(
    "post-callback liveness rolls back business work after provider logout",
    async () => {
      const own = await actor(),
        id = randomUUID()
      await assert.rejects(
        sessionTransaction(
          runtime!,
          own.session.id,
          own.identity,
          "companies:write",
          async (_principal, authorization) => {
            await authorization.client.query(
              "insert into gethired_private.companies(id,name,industry,type,specializations,location,slots,description,website,email,phone,hours) values ($1,'Rollback','Software','Services',array['Web'],'Cebu',0,'Test','','','','')",
              [id],
            )
            await operator!.query("delete from auth.sessions where id = $1", [
              own.session.id,
            ])
          },
        ),
        { code: "SESSION_EXPIRED" },
      )
      assert.equal(
        (
          await operator!.query(
            "select id from gethired_private.companies where id = $1",
            [id],
          )
        ).rows.length,
        0,
      )
    },
  )

  await run(
    "confirmed replay result commits revocation and prevents another refresh callback",
    async () => {
      const own = await actor()
      const denied = await store.withSession(
        own.session.id,
        null,
        false,
        async (_principal, revoke) => {
          await revoke()
          return new ApiError("SESSION_EXPIRED")
        },
      )
      assert.ok(denied instanceof ApiError)
      await assert.rejects(
        store.withSession(own.session.id, null, false, async () =>
          assert.fail("revoked refresh entered provider callback"),
        ),
        { code: "SESSION_EXPIRED" },
      )
    },
  )

  await run(
    "shared read does not update activity; authorized business read does",
    async () => {
      const own = await actor("student")
      await operator!.query(
        "update gethired_private.sessions set last_activity_at = clock_timestamp() - interval '1 minute' where id = $1",
        [own.session.id],
      )
      const before = await store.readSession(own.session.id, own.identity)
      const after = await store.readSession(own.session.id, own.identity)
      assert.equal(
        before.session.lastActivityAt.getTime(),
        after.session.lastActivityAt.getTime(),
      )
      await sessionTransaction(
        runtime!,
        own.session.id,
        own.identity,
        "companies:read",
        async () => {},
      )
      assert.ok(
        (await store.readSession(own.session.id, own.identity)).session
          .lastActivityAt > after.session.lastActivityAt,
      )
    },
  )

  const version = (await operator.query("show server_version")).rows[0]
    .server_version
  await writeFile(
    "docs/performance/phase2-postgres.json",
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        database: `Disposable local PostgreSQL ${version}; real multiple connections; no Supabase deployment`,
        checks,
      },
      null,
      2,
    ) + "\n",
  )
} finally {
  await runtime?.end()
  await operator?.end()
  // Identifier is generated above, never supplied by environment or a caller.
  await admin.query(`drop database if exists ${name} with (force)`)
  await admin.end()
}
