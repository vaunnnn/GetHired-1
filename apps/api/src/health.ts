import { ApiError } from "./api/errors.js"
import type { SqlPool } from "./auth/store.js"

export const REQUIRED_SCHEMA = "202610260001"

function failureReason(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined
  switch (code) {
    case "28P01": case "28000": return "database_login_rejected"
    case "42501": return "database_permission_denied"
    case "42P01": case "42883": case "42703": return "database_schema_incompatible"
    case "SELF_SIGNED_CERT_IN_CHAIN": case "DEPTH_ZERO_SELF_SIGNED_CERT":
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE": case "UNABLE_TO_GET_ISSUER_CERT_LOCALLY":
    case "CERT_HAS_EXPIRED": case "ERR_TLS_CERT_ALTNAME_INVALID": return "database_tls_failed"
    case "ENOTFOUND": case "EAI_AGAIN": return "database_dns_failed"
    case "ECONNREFUSED": case "ECONNRESET": case "ETIMEDOUT": return "database_connection_failed"
    case "53300": return "database_connection_limit"
    case "57014": return "database_query_timeout"
    default: return "database_probe_failed"
  }
}

interface ReadinessFailure {
  event: "api.readiness.failed"
  stage: string
  reason: string
}

// One in-flight probe per process prevents public probes exhausting the pool.
export function createReadinessProbe(pool: SqlPool,
  report: (failure: ReadinessFailure) => void = (failure) => console.error(JSON.stringify(failure)),
) {
  let pending: Promise<void> | undefined
  let lastReport = -Infinity
  return function ready(): Promise<void> {
    return pending ??= check().finally(() => { pending = undefined })
  }
  async function check() {
    let client: Awaited<ReturnType<SqlPool["connect"]>> | undefined
    let stage = "connect"
    let missingVersion = false
    try {
      client = await pool.connect()
      stage = "transaction"
      await client.query("begin read only")
      await client.query("set local statement_timeout = '2000ms'")
      stage = "schema_version"
      const result = await client.query(
        "select version from gethired_private.schema_versions where version = $1",
        [REQUIRED_SCHEMA],
      )
      if (result.rows.length !== 1) {
        missingVersion = true
        throw new Error("Schema unavailable")
      }
      // Exercise runtime grants and the provider bridge without reading user data.
      stage = "provider_bridge"
      await client.query(`select gethired_private.provider_session_live(
        '00000000-0000-0000-0000-000000000000'::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid)`)
      stage = "runtime_access"
      await client.query("select id from gethired_private.accounts limit 0")
      stage = "commit"
      await client.query("commit")
    } catch (error) {
      // Only fixed categories reach logs, never driver messages, SQL, or credentials.
      if (performance.now() - lastReport >= 60000) {
        lastReport = performance.now()
        try { report({ event: "api.readiness.failed", stage,
          reason: missingVersion ? "database_migration_missing" : failureReason(error) }) } catch { /* Logging cannot change readiness. */ }
      }
      if (client) try { await client.query("rollback") } catch { /* Safe failure below. */ }
      throw new ApiError("SERVICE_UNAVAILABLE")
    } finally { client?.release() }
  }
}
