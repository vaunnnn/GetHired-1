import { ApiError } from "../api/errors.js"
import type { SqlClient } from "../auth/store.js"
import type { Identity, Principal } from "../auth/types.js"

/** One protocol round trip. All locks, DB-clock checks and provider checks occur in SQL. */
export async function authorizeSession(
  client: SqlClient,
  sessionId: string,
  identity: Identity | null,
  options: { shared?: boolean; touch?: boolean; expected?: Principal } = {},
): Promise<Principal> {
  if (identity && identity.sessionId !== sessionId)
    throw new ApiError("UNAUTHENTICATED")
  const result = await client.query(
    "select gethired_private.authorize_session($1, $2, $3, $4) as authorization",
    [
      sessionId,
      identity?.userId ?? null,
      options.shared ?? false,
      options.touch ?? false,
    ],
  )
  const value = result.rows[0]?.authorization
  if (!value) throw new ApiError("SERVICE_UNAVAILABLE")
  if (value.error) {
    if (
      ["SESSION_EXPIRED", "UNAUTHENTICATED", "INVALID_CREDENTIALS"].includes(
        value.error,
      )
    )
      throw new ApiError(value.error)
    throw new ApiError("SERVICE_UNAVAILABLE")
  }
  const principal: Principal = {
    ...value,
    session: {
      ...value.session,
      createdAt: new Date(value.session.createdAt),
      expiresAt: new Date(value.session.expiresAt),
      lastActivityAt: new Date(value.session.lastActivityAt),
      revokedAt: value.session.revokedAt
        ? new Date(value.session.revokedAt)
        : null,
    },
  }
  if (
    options.expected &&
    (principal.id !== options.expected.id ||
      principal.user.role !== options.expected.user.role ||
      principal.identity.userId !== options.expected.identity.userId)
  )
    throw new ApiError("SESSION_EXPIRED")
  return principal
}
