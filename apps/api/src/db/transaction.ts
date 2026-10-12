import { ApiError } from "../api/errors.js"
import type { SqlClient, SqlPool } from "../auth/store.js"
import type { Principal } from "../auth/types.js"
import { sessionPolicy } from "../auth/types.js"
import { assertPermission, type Permission } from "../authorization/policy.js"

export async function transaction<T>(pool: SqlPool, work: (client: SqlClient) => Promise<T>): Promise<T> {
  let client: SqlClient | undefined
  try {
    client = await pool.connect()
    await client.query("begin")
    await client.query("set local lock_timeout = '5s'")
    await client.query("set local statement_timeout = '10s'")
    const result = await work(client)
    await client.query("commit")
    return result
  } catch (error) {
    if (client) try { await client.query("rollback") } catch { /* Preserve safe error. */ }
    throw error instanceof ApiError ? error : new ApiError("SERVICE_UNAVAILABLE")
  } finally { client?.release() }
}

// Sensitive feature writes must use this transaction, not a previously cached
// principal. Account then session lock order matches authentication/deactivation.
export async function authorizedTransaction<T>(pool: SqlPool, actor: Principal, permission: Permission,
  work: (client: SqlClient, actor: Principal) => Promise<T>): Promise<T> {
  return transaction(pool, async client => {
    await client.query("select gethired_private.lock_account($1)", [actor.id])
    const accounts = await client.query("select id, auth_user_id, role, status from gethired_private.accounts where id = $1", [actor.id])
    const account = accounts.rows[0]
    if (!account || account.status !== "active" || account.auth_user_id !== actor.identity.userId || account.role !== actor.user.role)
      throw new ApiError("SESSION_EXPIRED")
    const sessions = await client.query("select * from gethired_private.sessions where id = $1 and account_id = $2 for update", [actor.session.id, actor.id])
    const session = sessions.rows[0]
    const clock = await client.query("select clock_timestamp() as now")
    const now = new Date(clock.rows[0].now).getTime()
    if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= now ||
      new Date(session.last_activity_at).getTime() + sessionPolicy(account.role, session.remember_me).idleMs <= now)
      throw new ApiError("SESSION_EXPIRED")
    assertPermission(actor, permission)
    const providerLive = async () => {
      const result = await client.query("select gethired_private.provider_session_live($1, $2) as live", [actor.session.id, actor.identity.userId])
      if (!result.rows[0]?.live) throw new ApiError("SESSION_EXPIRED")
    }
    await providerLive()
    const result = await work(client, actor)
    await providerLive()
    await client.query("update gethired_private.sessions set last_activity_at = clock_timestamp() where id = $1", [actor.session.id])
    return result
  })
}
