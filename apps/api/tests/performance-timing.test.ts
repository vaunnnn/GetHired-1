import assert from "node:assert/strict"
import { test } from "node:test"
import { setTimeout as delay } from "node:timers/promises"
import { createApiRoute } from "../src/api/route.js"
import { ApiError } from "../src/api/errors.js"
import type { SqlPool } from "../src/auth/store.js"
import { transaction } from "../src/db/transaction.js"
import { readServerConfig } from "../src/config.js"
import type { RequestLog } from "../src/logging/request.js"
import {
  deploymentTiming,
  queryScope,
  requestTiming,
  safeTimings,
} from "../src/logging/timing.js"

test("concurrent requests keep query counts, pool observations and timings isolated without SQL or values", async () => {
  const entries: RequestLog[] = []
  let releases = 0
  const pool: SqlPool = {
    waitingCount: 2,
    async connect() {
      await delay(5)
      return {
        async query() {
          await delay(1)
          return { rows: [], rowCount: 0 }
        },
        release() {
          releases++
        },
      }
    },
  }
  const route = createApiRoute(
    {
      route: "/api/example",
      access: { kind: "protected", permission: "session:read" },
      methods: {
        GET: {
          body: "none",
          async handle({ request }) {
            await queryScope("db_business", () =>
              transaction(pool, async (client) => {
                const count = Number(
                  new URL(request.url).searchParams.get("count"),
                )
                for (let n = 0; n < count; n++)
                  await client.query("select 'secret SQL'", ["secret-value"])
              }),
            )
            return { data: {} }
          },
        },
      },
    },
    {
      config: () => readServerConfig({ APP_ORIGIN: "http://localhost:3000" }),
      logger: (entry) => {
        entries.push(entry)
      },
      async enforceAccess() {
        await transaction(pool, async (client) => {
          await client.query("select gethired_private.lock_account($1)", [
            "secret-id",
          ])
        })
        return { id: "11111111-1111-4111-8111-111111111111" }
      },
    },
  )
  const responses = await Promise.all(
    [1, 3].map((count) =>
      route.GET(new Request(`http://localhost/api/example?count=${count}`)),
    ),
  )
  assert.equal(releases, 4)
  assert.deepEqual(
    entries.map((e) => e.timings?.db_business?.count).sort(),
    [1, 3],
  )
  for (const response of responses) {
    assert.equal(response.status, 200)
    const entry = entries.find(
      (e) => e.requestId === response.headers.get("x-request-id"),
    )!
    assert.equal(entry.timings?.pool?.count, 2)
    assert.equal(entry.timings?.db_control?.count, 6)
    assert.equal(entry.timings?.db_lock?.count, 1)
    assert.equal(entry.timings?.authentication?.count, 1)
    assert.ok(entry.timings!.pool!.durationMs >= 5)
    assert.deepEqual(entry.connections, {
      firstSeen: 2,
      reused: 0,
      waitingMax: 2,
    })
    assert.match(
      response.headers.get("server-timing")!,
      /authentication;dur=\d/,
    )
    assert.equal(
      response.headers.get("server-timing")!.includes("secret"),
      false,
    )
  }
  assert.equal(JSON.stringify(entries).includes("secret"), false)
})

test("denied authentication retains safe error attribution and never enters the handler", async () => {
  let logged: RequestLog | undefined
  const route = createApiRoute(
    {
      route: "/api/example",
      access: { kind: "protected", permission: "session:read" },
      methods: {
        GET: {
          body: "none",
          handle() {
            assert.fail("denied request entered handler")
          },
        },
      },
    },
    {
      config: () => readServerConfig({ APP_ORIGIN: "http://localhost:3000" }),
      logger: (entry) => {
        logged = entry
      },
      async enforceAccess() {
        throw new ApiError("SESSION_EXPIRED")
      },
    },
  )
  const response = await route.GET(new Request("http://localhost/api/example"))
  assert.equal(response.status, 401)
  assert.equal(logged?.errorCode, "SESSION_EXPIRED")
  assert.equal(logged?.timings?.authentication?.count, 1)
  assert.equal(logged?.timings?.handler, undefined)
  assert.match(response.headers.get("server-timing")!, /api;dur=/)
})

test("failed connection and rolled back queries retain timings, release clients, and preserve safe failures", async () => {
  await requestTiming(async (context) => {
    await assert.rejects(
      transaction(
        {
          async connect() {
            throw new Error("secret")
          },
        },
        async () => {},
      ),
      { code: "SERVICE_UNAVAILABLE" },
    )
    assert.equal(context.timings.pool?.count, 1)
    assert.equal(context.timings.transaction?.count, 1)
  })
  let releases = 0
  const statements: string[] = []
  const connection = {
    async query(sql: string) {
      statements.push(sql)
      return { rows: [], rowCount: 0 }
    },
    release() {
      releases++
    },
  }
  const pool = {
    async connect() {
      return connection
    },
  }
  await requestTiming(async (context) => {
    await assert.rejects(
      transaction(pool, async () => {
        throw new ApiError("SESSION_EXPIRED")
      }),
      { code: "SESSION_EXPIRED" },
    )
    await transaction(pool, async () => {})
    assert.deepEqual(context.connections, {
      firstSeen: 1,
      reused: 1,
      waitingMax: 0,
    })
    assert.equal(context.timings.db_control?.count, 6)
  })
  assert.ok(statements.includes("rollback"))
  assert.equal(releases, 2)
})

test("telemetry emits only finite measurements and explicit region labels", () => {
  assert.deepEqual(
    safeTimings({
      api: { durationMs: Infinity, count: 1 },
      handler: { durationMs: 1.2345, count: 1 },
      secret: { durationMs: 1, count: 1 },
    } as never),
    { handler: { durationMs: 1.23, count: 1 } },
  )
  assert.deepEqual(
    deploymentTiming({
      DATABASE_URL: "postgres://secret",
      VERCEL_REGION: "sin1",
    }),
    { serviceRegion: "sin1", databaseRegion: "unknown" },
  )
  assert.deepEqual(
    deploymentTiming({
      API_REGION: "https://secret",
      DATABASE_REGION: "ap-southeast-1",
    }),
    { serviceRegion: "unknown", databaseRegion: "ap-southeast-1" },
  )
})
