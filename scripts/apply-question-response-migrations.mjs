// Run from the repository root with --env-file=apps/api/.env.local.
// Default is read-only inspection. --apply runs only these two approved migrations.
import { readFile } from "node:fs/promises"
import { Client } from "pg"

const apply = process.argv.includes("--apply")
if (process.argv.slice(2).some(arg => arg !== "--apply")) throw new Error("Only --apply is supported.")
const project = "vbddvogwnyvgeejaxpgv"
if (process.env.SUPABASE_URL !== `https://${project}.supabase.co`)
  throw new Error("The configured project does not match the documented GetHired staging target.")
const database = new URL(process.env.DATABASE_URL)
if (!database.hostname.endsWith(".supabase.com") && !database.hostname.endsWith(".supabase.co"))
  throw new Error("Unexpected database host.")
if (!database.username.endsWith(`.${project}`) && database.hostname !== `db.${project}.supabase.co`)
  throw new Error("Database connection does not identify the staging project.")
const migrations = ["202610270001_question_response_definitions.sql", "202610270002_question_response_rules.sql"]
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 10000, statement_timeout: 15000 })
try {
  await client.connect()
  const versions = await client.query("select version from gethired_private.schema_versions order by version")
  const applied = new Set(versions.rows.map(row => row.version))
  if (!applied.has("202610140001")) throw new Error("prerequisite_missing")
  const counts = await client.query("select count(*)::int as questions, count(*) filter (where status='active' and length(btrim(feedback, E' \\t\\n\\r'))=0)::int as active_blank_rubrics from gethired_private.questions")
  const permissions = await client.query("select pg_has_role(current_user, c.relowner, 'USAGE') as owns_questions from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='gethired_private' and c.relname='questions'")
  console.log(JSON.stringify({ target: "documented GetHired staging", ...counts.rows[0], ...permissions.rows[0], pending: migrations.filter(name => !applied.has(name.slice(0, 12))) }))
  if (apply) {
    if (!permissions.rows[0]?.owns_questions) throw new Error("operator_required")
    await client.query("select pg_advisory_lock(20261027, 1)")
    for (const name of migrations) {
      const version = name.slice(0, 12)
      const existing = await client.query("select version from gethired_private.schema_versions where version=$1", [version])
      if (existing.rows.length) continue
      await client.query(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"))
      console.log(JSON.stringify({ applied: name }))
    }
    const result = await client.query("select response_definition->>'format' as format, status, count(*)::int as count from gethired_private.questions group by 1,2 order by 1,2")
    console.log(JSON.stringify({ verified: result.rows }))
  }
} catch (error) {
  // Avoid printing driver messages, connection strings, or query contents.
  const code = typeof error?.code === "string" ? error.code : ["prerequisite_missing", "operator_required"].includes(error?.message) ? error.message : "operation_failed"
  console.error(JSON.stringify({ event: "question_response_migration_failed", code }))
  process.exitCode = 1
} finally { await client.end() }
