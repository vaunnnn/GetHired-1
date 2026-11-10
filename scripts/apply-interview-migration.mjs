// Uses the documented staging operator connection. No credentials or student data are printed.
// Read-only by default; --apply applies only the approved interview migration.
import { readFile } from "node:fs/promises"
import { Client } from "pg"
const apply = process.argv.includes("--apply")
if (process.argv.slice(2).some((a) => a !== "--apply"))
  throw new Error("Only --apply is supported.")
const project = "vbddvogwnyvgeejaxpgv"
if (process.env.SUPABASE_URL !== `https://${project}.supabase.co`)
  throw new Error("Unexpected staging target.")
const url = new URL(process.env.DATABASE_URL)
if (
  (!url.hostname.endsWith(".supabase.com") &&
    !url.hostname.endsWith(".supabase.co")) ||
  (!url.username.endsWith(`.${project}`) &&
    url.hostname !== `db.${project}.supabase.co`)
)
  throw new Error("Unexpected staging database.")
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  connectionTimeoutMillis: 10000,
  statement_timeout: 15000,
})
try {
  await client.connect()
  const versions = (
    await client.query(
      "select version from gethired_private.schema_versions order by version",
    )
  ).rows.map((r) => r.version)
  for (const required of ["202610260001", "202610270001", "202610270002"])
    if (!versions.includes(required)) throw new Error("prerequisite_missing")
  const permission = (
    await client.query(
      "select pg_has_role(current_user,nspowner,'USAGE') as owns_schema from pg_namespace where nspname='gethired_private'",
    )
  ).rows[0]
  console.log(
    JSON.stringify({
      target: "documented GetHired staging",
      previousResponseMigrationsApplied: true,
      operator: permission.owns_schema,
      pending: !versions.includes("202610280001"),
    }),
  )
  if (apply) {
    if (!permission.owns_schema) throw new Error("operator_required")
    await client.query("select pg_advisory_lock(20261028,1)")
    const applied = await client.query(
      "select version from gethired_private.schema_versions where version='202610280001'",
    )
    if (!applied.rows.length)
      await client.query(
        await readFile(
          new URL(
            "../supabase/migrations/202610280001_interview_attempts.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      )
    const result = await client.query(
      "select count(*)::int as tables from information_schema.tables where table_schema='gethired_private' and table_name in ('interview_attempts','attempt_questions','attempt_answers','interview_evaluation_budget')",
    )
    console.log(
      JSON.stringify({
        migration: "202610280001",
        verifiedTables: result.rows[0].tables,
      }),
    )
  }
} catch (e) {
  console.error(
    JSON.stringify({
      event: "interview_migration_failed",
      code:
        typeof e.code === "string"
          ? e.code
          : ["prerequisite_missing", "operator_required"].includes(e.message)
            ? e.message
            : "operation_failed",
    }),
  )
  process.exitCode = 1
} finally {
  await client.end()
}
