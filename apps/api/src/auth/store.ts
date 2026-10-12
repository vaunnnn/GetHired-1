import { Pool, type QueryResultRow } from "pg"
import { ApiError } from "../api/errors.js"
import { transaction as runTransaction } from "../db/transaction.js"
import type { AuthConfig } from "./config.js"
import {
  sessionPolicy,
  type Identity,
  type Principal,
  type Session,
  type User,
} from "./types.js"

export interface SqlClient {
  query<R extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: unknown[],
  ): Promise<{
    rows: R[]
    rowCount: number | null
  }>
  release(): void
}
export interface SqlPool {
  connect(): Promise<SqlClient>
}
export interface AuthStore {
  resolveIdentifier(identifier: string): Promise<string | null>
  createSession(identity: Identity, rememberMe: boolean): Promise<Principal>
  withSession<T>(
    sessionId: string,
    identity: Identity | null,
    touch: boolean,
    work: (principal: Principal, revoke: () => Promise<void>) => Promise<T>,
  ): Promise<T>
  revokeSession(sessionId: string): Promise<void>
  revokeAll(accountId: string): Promise<void>
  completeCleanup(sessionId: string): Promise<void>
  consumeLimit(key: string, max: number, seconds: number): Promise<void>
  refundLimit(key: string): Promise<void>
}

const accountSelect = `select a.*, p.student_number, p.first_name, p.last_name, p.course, p.year_level
  from gethired_private.accounts a left join gethired_private.student_profiles p on p.account_id = a.id`
function user(row: QueryResultRow): User {
  if (row.role === "student" && !row.student_number)
    throw new ApiError("INVALID_CREDENTIALS")
  return {
    id: row.id,
    role: row.role,
    displayName: row.display_name,
    email: row.email,
    student:
      row.role === "student"
        ? {
            studentNumber: row.student_number,
            firstName: row.first_name,
            lastName: row.last_name,
            course: row.course,
            yearLevel: row.year_level,
          }
        : null,
  }
}
function session(row: QueryResultRow): Session {
  return {
    id: row.id,
    accountId: row.account_id,
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
    lastActivityAt: new Date(row.last_activity_at),
    rememberMe: row.remember_me,
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
  }
}

export function createAuthStore(pool: SqlPool): AuthStore {
  async function transaction<T>(
    work: (client: SqlClient) => Promise<T>,
  ): Promise<T> {
    return runTransaction(pool, work)
  }
  async function revoke(client: SqlClient, sessionId: string) {
    await client.query(
      "update gethired_private.sessions set revoked_at = coalesce(revoked_at, clock_timestamp()) where id = $1",
      [sessionId],
    )
    await client.query(
      `insert into gethired_private.provider_cleanup(session_id, auth_user_id)
      select s.id, a.auth_user_id from gethired_private.sessions s join gethired_private.accounts a on a.id = s.account_id
      where s.id = $1 on conflict (session_id) do nothing`,
      [sessionId],
    )
  }
  async function live(client: SqlClient, identity: Identity) {
    const result = await client.query(
      "select gethired_private.provider_session_live($1, $2) as live",
      [identity.sessionId, identity.userId],
    )
    if (!result.rows[0]?.live) throw new ApiError("SESSION_EXPIRED")
  }
  return {
    resolveIdentifier: (identifier) =>
      transaction(async (client) => {
        const result = await client.query(
          `${accountSelect} where lower(a.email) = lower($1) or (a.role = 'student' and p.student_number = $1)`,
          [identifier],
        )
        return result.rows[0]?.email ?? null
      }),
    createSession: (identity, rememberMe) =>
      transaction(async (client) => {
        await client.query(
          "select gethired_private.lock_account(id) from gethired_private.accounts where auth_user_id = $1",
          [identity.userId],
        )
        const result = await client.query(
          `${accountSelect} where a.auth_user_id = $1`,
          [identity.userId],
        )
        const account = result.rows[0]
        if (!account || account.status !== "active")
          throw new ApiError("INVALID_CREDENTIALS")
        const projection = user(account)
        await live(client, identity)
        const policy = sessionPolicy(projection.role, rememberMe)
        const created = await client.query(
          `insert into gethired_private.sessions(id, account_id, created_at, expires_at, last_activity_at, remember_me)
        values ($1, $2, now(), now() + $3 * interval '1 millisecond', now(), $4) returning *`,
          [
            identity.sessionId,
            account.id,
            policy.absoluteMs,
            policy.rememberMe,
          ],
        )
        return {
          id: account.id,
          identity,
          user: projection,
          session: session(created.rows[0]),
        }
      }),
    withSession: (sessionId, identity, touch, work) =>
      transaction(async (client) => {
        // Lock account before session in every flow, matching account-change triggers.
        await client.query(
          "select gethired_private.lock_account(account_id) from gethired_private.sessions where id = $1",
          [sessionId],
        )
        const accounts = await client.query(
          `${accountSelect} where a.id = (select account_id from gethired_private.sessions where id = $1)`,
          [sessionId],
        )
        const account = accounts.rows[0]
        if (!account || account.status !== "active")
          throw new ApiError("SESSION_EXPIRED")
        const rows = await client.query(
          "select *, clock_timestamp() as checked_at from gethired_private.sessions where id = $1 for update",
          [sessionId],
        )
        if (!rows.rows[0]) throw new ApiError("SESSION_EXPIRED")
        const current = session(rows.rows[0])
        // Read time after acquiring the row lock, so time spent waiting cannot revive expiry.
        const checked = await client.query(
          "select clock_timestamp() as checked_at",
        )
        const now = new Date(checked.rows[0].checked_at).getTime()
        const verified = { userId: account.auth_user_id, sessionId }
        if (
          identity &&
          (identity.userId !== verified.userId ||
            identity.sessionId !== sessionId)
        )
          throw new ApiError("UNAUTHENTICATED")
        if (
          current.revokedAt ||
          current.expiresAt.getTime() <= now ||
          current.lastActivityAt.getTime() +
            sessionPolicy(account.role, current.rememberMe).idleMs <=
            now
        )
          throw new ApiError("SESSION_EXPIRED")
        await live(client, verified)
        const result = await work(
          {
            id: account.id,
            identity: verified,
            user: user(account),
            session: current,
          },
          () => revoke(client, sessionId),
        )
        if (!(result instanceof ApiError)) await live(client, verified)
        if (touch && !(result instanceof ApiError))
          await client.query(
            "update gethired_private.sessions set last_activity_at = clock_timestamp() where id = $1 and revoked_at is null",
            [sessionId],
          )
        return result
      }),
    revokeSession: (sessionId) =>
      transaction(async (client) => {
        await revoke(client, sessionId)
      }),
    revokeAll: (accountId) =>
      transaction(async (client) => {
        await client.query("select gethired_private.lock_account($1, true)", [
          accountId,
        ])
        const rows = await client.query(
          "select id from gethired_private.sessions where account_id = $1",
          [accountId],
        )
        for (const row of rows.rows) await revoke(client, row.id)
      }),
    completeCleanup: (sessionId) =>
      transaction(async (client) => {
        await client.query(
          "update gethired_private.provider_cleanup set completed_at = clock_timestamp() where session_id = $1",
          [sessionId],
        )
      }),
    consumeLimit: async (key, max, seconds) => {
      const retry = await transaction(async (client) => {
        const result = await client.query(
          `insert into gethired_private.auth_limits(key, count, expires_at)
          values ($1, 1, now() + $2 * interval '1 second') on conflict (key) do update set
          count = case when auth_limits.expires_at <= now() then 1 else auth_limits.count + 1 end,
          expires_at = case when auth_limits.expires_at <= now() then excluded.expires_at else auth_limits.expires_at end
          returning count, greatest(1, ceil(extract(epoch from expires_at - now()))) as retry`,
          [key, seconds],
        )
        return result.rows[0].count > max ? Number(result.rows[0].retry) : null
      })
      if (retry) throw new ApiError("RATE_LIMITED", { retryAfter: retry })
    },
    refundLimit: (key) =>
      transaction(async (client) => {
        await client.query(
          "update gethired_private.auth_limits set count = greatest(0, count - 1) where key = $1",
          [key],
        )
      }),
  }
}

export function createDatabasePool(config: AuthConfig): Pool {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: true },
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 15000,
  })
  // Never send connection diagnostics (which can include credentials) to stdout.
  pool.on("error", () => {})
  return pool
}
