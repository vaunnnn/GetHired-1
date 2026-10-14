import { Pool } from "pg"

// Separate process and credential: never called by the HTTP runtime.
const connectionString = process.env.MAINTENANCE_DATABASE_URL
function validConnection(value: string | undefined): value is string {
  try {
    const url = new URL(value ?? "")
    return ["postgres:", "postgresql:"].includes(url.protocol) && !!url.hostname &&
      !!url.username && !url.search && !url.hash
  } catch { return false }
}
if (!validConnection(connectionString)) {
  console.error("MAINTENANCE_DATABASE_URL must be a PostgreSQL URL without query options.")
  process.exitCode = 1
} else {
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: true }, max: 1,
    connectionTimeoutMillis: 5000, statement_timeout: 30000, query_timeout: 35000 })
  pool.on("error", () => {})
  try {
    const result = await pool.query(`select
      gethired_private.process_provider_cleanup(100) as cleaned,
      gethired_private.prune_auth_limits(1000) as pruned,
      gethired_private.prune_onboarding(1000) as onboarding_pruned`)
    console.log(JSON.stringify({ event: "maintenance_completed", ...result.rows[0] }))
  } catch {
    console.error("Maintenance failed; retry on the next scheduled run.")
    process.exitCode = 1
  } finally { await pool.end() }
}
