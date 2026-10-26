import {
  time,
  queryScope,
  queryTiming,
  recordConnection,
} from "../logging/timing.js"
import { ApiError } from "../api/errors.js"
import type { SqlClient, SqlPool } from "../auth/store.js"
import type { Principal } from "../auth/types.js"
import type { Identity } from "../auth/types.js"
import { authorizeSession } from "./authorization.js"
import { assertPermission, type Permission } from "../authorization/policy.js"

export async function transaction<T>(
  pool: SqlPool,
  work: (client: SqlClient) => Promise<T>,
): Promise<T> {
  return time("transaction", async () => {
    let client: SqlClient | undefined
    try {
      const waiting = pool.waitingCount
      const connection = await time("pool", () => pool.connect())
      recordConnection(connection, waiting)
      client = {
        query: (sql, values) =>
          queryTiming(sql, () => connection.query(sql, values)),
        release: () => connection.release(),
      }
      await client.query("begin")
      await client.query(
        "select set_config('lock_timeout', '5s', true), set_config('statement_timeout', '10s', true)",
      )
      const result = await work(client)
      await client.query("commit")
      return result
    } catch (error) {
      if (client)
        try {
          await client.query("rollback")
        } catch {
          /* Preserve safe error. */
        }
      throw error instanceof ApiError
        ? error
        : new ApiError("SERVICE_UNAVAILABLE")
    } finally {
      client?.release()
    }
  })
}

// Explicit, request-local ownership. A context is valid only during its callback
// and may only be reused with the same pool and exact verified principal.
export interface AuthorizationTransaction {
  readonly pool: SqlPool
  readonly client: SqlClient
  readonly actor: Principal
}
const active = new WeakSet<AuthorizationTransaction>()

export async function sessionTransaction<T>(
  pool: SqlPool,
  sessionId: string,
  identity: Identity,
  permission: Permission,
  work: (
    actor: Principal,
    authorization: AuthorizationTransaction,
  ) => Promise<T>,
): Promise<T> {
  return time("authorized", () =>
    queryScope("db_auth", () =>
      transaction(pool, async (client) => {
        const actor = await time("authentication", () =>
          authorizeSession(client, sessionId, identity),
        )
        assertPermission(actor, permission)
        const authorization: AuthorizationTransaction = Object.freeze({
          pool,
          client,
          actor,
        })
        active.add(authorization)
        try {
          const result = await work(actor, authorization)
          // Database time/liveness are checked again before committing activity or work.
          await authorizeSession(client, sessionId, identity, {
            expected: actor,
            touch: true,
          })
          return result
        } finally {
          active.delete(authorization)
        }
      }),
    ),
  )
}

// Standalone repository calls still fully reauthorize; routed calls explicitly
// reuse their enclosing authorized transaction. Ownership/permission checks remain.
export async function authorizedTransaction<T>(
  pool: SqlPool,
  actor: Principal,
  permission: Permission,
  work: (client: SqlClient, actor: Principal) => Promise<T>,
  authorization?: AuthorizationTransaction,
): Promise<T> {
  if (authorization) {
    if (
      !active.has(authorization) ||
      authorization.pool !== pool ||
      authorization.actor !== actor
    )
      throw new ApiError("SERVICE_UNAVAILABLE")
    assertPermission(actor, permission)
    try {
      return await queryScope("db_business", () =>
        work(authorization.client, actor),
      )
    } catch (error) {
      throw error instanceof ApiError
        ? error
        : new ApiError("SERVICE_UNAVAILABLE")
    }
  }
  return sessionTransaction(
    pool,
    actor.session.id,
    actor.identity,
    permission,
    async (current, context) => {
      if (current.id !== actor.id || current.user.role !== actor.user.role)
        throw new ApiError("SESSION_EXPIRED")
      return queryScope("db_business", () => work(context.client, current))
    },
  )
}
