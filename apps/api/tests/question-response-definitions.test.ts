import assert from "node:assert/strict"
import { test } from "node:test"
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
import { responseDefinition, publicResponseDefinition } from "../src/modules/interviews/response-definition.js"

const multipleChoice = {
  format: "multiple_choice",
  options: [{ id: "a", text: "First choice" }, { id: "b", text: "Second choice" }],
  correctOptionId: "b",
}
const invalidDefinitions: unknown[] = [
  null, [], {}, { format: "essay" }, { format: "written", correctOptionId: "a" },
  { ...multipleChoice, options: [] },
  { ...multipleChoice, options: [multipleChoice.options[0]] },
  { ...multipleChoice, options: Array.from({ length: 7 }, (_, i) => ({ id: `option${i}`, text: `Choice ${i}` })) },
  { ...multipleChoice, correctOptionId: "missing" },
  { ...multipleChoice, correctOptionId: null },
  { ...multipleChoice, options: null },
  { ...multipleChoice, options: [null, multipleChoice.options[1]] },
  { ...multipleChoice, options: [{ id: "a" }, multipleChoice.options[1]] },
  { ...multipleChoice, options: [{ id: "a", text: 42 }, multipleChoice.options[1]] },
  { ...multipleChoice, options: [multipleChoice.options[0], { id: "a", text: "Other" }] },
  { ...multipleChoice, options: [multipleChoice.options[0], { id: "b", text: " first CHOICE " }] },
  { ...multipleChoice, options: [{ id: "bad id", text: "Choice" }, multipleChoice.options[1]] },
  { ...multipleChoice, options: [{ id: "a", text: " \n\t" }, multipleChoice.options[1]] },
  { ...multipleChoice, options: [{ id: "a", text: "x".repeat(1001) }, multipleChoice.options[1]] },
  { ...multipleChoice, options: [{ ...multipleChoice.options[0], isCorrect: true }, multipleChoice.options[1]] },
  { ...multipleChoice, score: 100 },
]

test("response definitions validate single-answer MCQs and keep answer keys private", () => {
  assert.deepEqual(responseDefinition({ format: "written" }), { format: "written" })
  const parsed = responseDefinition(multipleChoice)
  assert.deepEqual(parsed, multipleChoice)
  assert.deepEqual(publicResponseDefinition(parsed), { format: "multiple_choice", options: multipleChoice.options })
  assert.ok(!("correctOptionId" in publicResponseDefinition(parsed)))
  assert.deepEqual(publicResponseDefinition({ format: "written" }), { format: "written" })
  for (const value of invalidDefinitions) assert.throws(() => responseDefinition(value), { code: "VALIDATION_ERROR" })
})

test("response migration preserves seeded written questions and constrains persisted MCQs", async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role gethired_runtime;
      create schema gethired_private;
      grant usage on schema gethired_private to gethired_runtime;
      create table gethired_private.schema_versions(version text primary key);`)
    const sql = (name: string) => readFile(new URL(`../../../supabase/${name}`, import.meta.url), "utf8")
    await db.exec(await sql("migrations/202610140001_b6_question_bank.sql"))
    await db.exec(await sql("seeds/b6_question_bank.sql"))
    const before = await db.query("select id,question,feedback from gethired_private.questions order by id")
    await db.exec(await sql("migrations/202610270001_question_response_definitions.sql"))
    assert.deepEqual((await db.query("select id,question,feedback from gethired_private.questions order by id")).rows, before.rows)
    const defaults = await db.query<{ response_definition: unknown }>("select response_definition from gethired_private.questions")
    assert.ok(defaults.rows.length > 0)
    assert.ok(defaults.rows.every(row => JSON.stringify(row.response_definition) === '{"format":"written"}'))
    const id = (before.rows[0] as { id: string }).id
    await db.exec("set role gethired_runtime")
    await db.query("update gethired_private.questions set response_definition=$1 where id=$2", [JSON.stringify(multipleChoice), id])
    assert.deepEqual((await db.query<{ response_definition: unknown }>("select response_definition from gethired_private.questions where id=$1", [id])).rows[0].response_definition, multipleChoice)
    for (const value of invalidDefinitions) {
      await assert.rejects(db.query("update gethired_private.questions set response_definition=$1 where id=$2", [JSON.stringify(value), id]), { code: "23514" })
    }
    await assert.rejects(db.query("update gethired_private.questions set response_definition=null where id=$1", [id]), { code: "23502" })
    await db.exec("reset role")
    // Prepare old written content with a blank rubric and prove migration keeps it
    // as an inactive draft rather than fabricating evaluation criteria.
    await db.query("update gethired_private.questions set response_definition=$1, feedback='' where id=$2", [JSON.stringify({ format: "written" }), id])
    await db.exec(await sql("migrations/202610270002_question_response_rules.sql"))
    assert.equal((await db.query<{ status: string }>("select status from gethired_private.questions where id=$1", [id])).rows[0].status, "inactive")
    await db.exec("set role gethired_runtime")
    await assert.rejects(db.query("update gethired_private.questions set status='active' where id=$1", [id]), { code: "23514" })
    await db.query("update gethired_private.questions set type='Coding', response_definition=$1, status='active' where id=$2", [JSON.stringify(multipleChoice), id])
    await assert.rejects(db.query("update gethired_private.questions set feedback='Explanation' where id=$1", [id]), { code: "23514" })
    await assert.rejects(db.query("update gethired_private.questions set type='Introduction' where id=$1", [id]), { code: "23514" })
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`reset role; set role ${role}`)
      await assert.rejects(db.query("select response_definition,feedback from gethired_private.questions"), { code: "42501" })
    }
  } finally { await db.close() }
})
