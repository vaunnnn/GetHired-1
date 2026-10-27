import assert from "node:assert/strict"
import { test } from "node:test"
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"

test("B2 migrations restrict maintenance and prune only expired counters", async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, banned_until timestamptz,
        confirmation_token text, recovery_token text, confirmation_sent_at timestamptz, recovery_sent_at timestamptz);
      create table auth.sessions(id uuid primary key, user_id uuid references auth.users(id), not_after timestamptz);
      create table auth.refresh_tokens(session_id uuid references auth.sessions(id) on delete cascade, revoked boolean);`)
    await db.exec(await readFile(new URL("../../../supabase/preflight.sql", import.meta.url), "utf8"))
    for (const file of ["202609290001_phase3_auth.sql", "202610050001_b2_operations.sql"]) {
      await db.exec(await readFile(new URL(`../../../supabase/migrations/${file}`, import.meta.url), "utf8"))
    }
    for (const role of ["anon", "authenticated", "gethired_runtime", "gethired_maintenance"]) {
      const { rows } = await db.query<{ cleanup: boolean; prune: boolean }>(`select
        has_function_privilege($1, 'gethired_private.process_provider_cleanup(integer)', 'execute') as cleanup,
        has_function_privilege($1, 'gethired_private.prune_auth_limits(integer)', 'execute') as prune`, [role])
      assert.deepEqual(rows[0], { cleanup: role === "gethired_maintenance", prune: role === "gethired_maintenance" })
    }
    await db.exec(`insert into gethired_private.auth_limits values
      ('expired1', 1, now() - interval '1 hour'), ('expired2', 1, now() - interval '1 hour'),
      ('active', 1, now() + interval '1 hour'); set role gethired_maintenance;`)
    const { rows } = await db.query<{ removed: number }>("select gethired_private.prune_auth_limits(1) as removed")
    assert.equal(rows[0].removed, 1)
    await assert.rejects(db.exec("select * from gethired_private.accounts"))
    await assert.rejects(db.exec("select gethired_private.prune_auth_limits(0)"))
    await db.exec("reset role")
    const remaining = await db.query<{ key: string }>("select key from gethired_private.auth_limits order by key")
    assert.equal(remaining.rows.length, 2)
    assert.equal(remaining.rows[0].key, "active")
    await db.exec("set role gethired_runtime")
    const marker = await db.query<{ version: string }>("select version from gethired_private.schema_versions")
    assert.equal(marker.rows[0].version, "202610050001")
    await assert.rejects(db.exec("delete from gethired_private.schema_versions"))
  } finally { await db.close() }
})
