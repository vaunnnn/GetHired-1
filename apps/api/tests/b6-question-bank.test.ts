import assert from "node:assert/strict"
import { test } from "node:test"
import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
import { categoryInput, questionInput, phaseInput, bankQuery, DEFAULT_PHASES } from "../src/modules/interviews/validation.js"
import { createBankRepository, selectPipeline } from "../src/modules/interviews/repository.js"
import { createAuthStore, type SqlPool, type SqlClient } from "../src/auth/store.js"
import type { Principal } from "../src/auth/types.js"
import type { Category, Question } from "@gethired/contracts"

const input = { name: "New track", description: "Practice", color: "#112233", bg: "#ffffff" }
const query = (value = "", admin = false) => bankQuery(new URLSearchParams(value), admin)
test("B6 rejects mass assignment, ambiguous filters and invalid pipeline configuration", () => {
  assert.deepEqual(categoryInput({ name: "Renamed" }, true), { name: "Renamed" })
  for (const value of [{}, { id: randomUUID() }, { color: "red" }, { phases: [] }, { phases: [{ ...DEFAULT_PHASES[0], count: 0 }] }, { phases: [DEFAULT_PHASES[0], DEFAULT_PHASES[0]] }])
    assert.throws(() => categoryInput(value, true), { code: "VALIDATION_ERROR" })
  assert.throws(() => phaseInput([{ ...DEFAULT_PHASES[0], types: ["Introduction", "Introduction"] }]), { code: "VALIDATION_ERROR" })
  for (const value of ["status=inactive", "page=0", "pageSize=101", "page=1&page=2", "ownerId=123"])
    assert.throws(() => query(value), { code: "VALIDATION_ERROR" })
  assert.throws(() => questionInput({ question: "Q", type: "Other", hint: "", feedback: "" }), { code: "VALIDATION_ERROR" })
  assert.equal(questionInput({ question: "Q", type: "Design Challenge", hint: "", feedback: "Required design criteria" }).type, "Design Challenge")
  const questions = Array.from({ length: 3 }, (_, n) => ({ id: String(n), question: "Q", hint: "Hint", type: "Technical", feedback: "SECRET", status: "active", responseDefinition: { format: "written" } } as Question))
  const result = selectPipeline([DEFAULT_PHASES[1]], questions)
  assert.equal(new Set(result[0].questions.map(q => q.id)).size, 2)
  assert.ok(!JSON.stringify(result).includes("SECRET"))
  assert.ok(!("feedback" in result[0].questions[0]))
  assert.throws(() => selectPipeline([DEFAULT_PHASES[1]], [{ ...questions[0], status: "inactive" }]), { code: "CATEGORY_UNAVAILABLE" })
})

test("B6 PostgreSQL persists edits, excludes rubrics, rejects inactive/short banks and rolls back audit failures", async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, email_confirmed_at timestamptz, banned_until timestamptz);
      create table auth.sessions(id uuid primary key, user_id uuid references auth.users(id), not_after timestamptz);
      create table auth.refresh_tokens(session_id uuid references auth.sessions(id) on delete cascade, revoked boolean);`)
    for (const name of ["202609290001_phase3_auth.sql", "202610050001_b2_operations.sql", "202610120001_b3_feature_foundation.sql", "202610140001_b6_question_bank.sql", "202610270001_question_response_definitions.sql", "202610270002_question_response_rules.sql"])
      await db.exec(await readFile(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8"))
    await db.exec("alter table gethired_private.accounts add column credentials_blocked boolean not null default false; alter table gethired_private.accounts add column credential_version integer not null default 0")
  await db.exec(await readFile(new URL("../../../supabase/migrations/202610260001_session_authorization.sql", import.meta.url), "utf8"))
    const seed = await readFile(new URL("../../../supabase/seeds/b6_question_bank.sql", import.meta.url), "utf8")
    await db.exec(seed); await db.exec(seed)
    const client = { query: async (sql: string, values?: unknown[]) => { const r = await db.query(sql, values); return { rows: r.rows, rowCount: r.affectedRows ?? 0 } }, release() {} } as SqlClient
    const pool: SqlPool = { connect: async () => client }
    const actor = async (role: "student" | "admin"): Promise<Principal> => {
      await db.exec("reset role")
      const authId = randomUUID(), id = randomUUID(), sessionId = randomUUID()
      await db.query("insert into auth.users values ($1,now(),null)", [authId])
      await db.query("insert into auth.sessions values ($1,$2,null)", [sessionId, authId])
      await db.query("insert into auth.refresh_tokens values ($1,false)", [sessionId])
      await db.query("insert into gethired_private.accounts(id,auth_user_id,email,display_name,role,status) values ($1,$2,$3,'Test',$4,'active')", [id,authId,`${id}@example.test`,role])
      if (role === "student") await db.query("insert into gethired_private.student_profiles(account_id,student_number,first_name,last_name,course,year_level) values ($1,'12345678','Test','Student','BS IT','4th Year')", [id])
      await db.exec("set role gethired_runtime")
      return createAuthStore(pool).createSession({ userId: authId, sessionId }, false)
    }
    const admin = await actor("admin"), student = await actor("student"), repo = createBankRepository(pool)
    const seeded = await repo.list(student, query("pageSize=100"), false)
    assert.equal(seeded.meta.total, 12)
    for (const cat of seeded.data as Category[]) {
      const pipeline = await repo.pipeline(student, cat.id)
      assert.ok(pipeline.every(p => p.questions.length > 0))
      assert.ok(pipeline.flatMap(p => p.questions).every(q => Object.keys(q).sort().join() === "hint,id,question,responseDefinition,type"))
    }
    await assert.rejects(repo.save(student, randomUUID(), input, "category"), { code: "FORBIDDEN" })
    await assert.rejects(repo.list(student, query(), true), { code: "FORBIDDEN" })
    const cat = await repo.save(admin, randomUUID(), categoryInput(input), "category") as Category
    await assert.rejects(repo.list(student, query(), false, cat.id), { code: "FORBIDDEN" })
    assert.deepEqual(cat.phases, DEFAULT_PHASES)
    await assert.rejects(repo.pipeline(student, cat.id), { code: "CATEGORY_UNAVAILABLE" })
    await repo.save(admin, randomUUID(), categoryInput({ phases: [DEFAULT_PHASES[0]] }, true), "category", cat.id)
    const question = await repo.save(admin, randomUUID(), questionInput({ question: "Introduce yourself", type: "Introduction", hint: "Be specific", feedback: "PRIVATE RUBRIC" }), "question", undefined, cat.id) as Question
    assert.equal((await repo.pipeline(student, cat.id))[0].questions[0].question, "Introduce yourself")
    await repo.save(admin, randomUUID(), questionInput({ question: "Updated intro" }, true), "question", question.id)
    assert.equal((await createBankRepository(pool).pipeline(student, cat.id))[0].questions[0].question, "Updated intro")
    assert.equal((await repo.list(admin, query(), true, cat.id)).data.length, 1)
    await repo.save(admin, randomUUID(), { status: "inactive" }, "question", question.id)
    await assert.rejects(repo.pipeline(student, cat.id), { code: "CATEGORY_UNAVAILABLE" })
    await repo.save(admin, randomUUID(), { status: "active" }, "question", question.id)
    await repo.save(admin, randomUUID(), { status: "inactive" }, "category", cat.id)
    await assert.rejects(repo.pipeline(student, cat.id), { code: "NOT_FOUND" })
    assert.equal((await repo.list(student, query("pageSize=100"), false)).meta.total, 12)
    assert.equal((await repo.list(admin, query("status=inactive", true), true)).meta.total, 1)
    const empty = await repo.list(admin, query("page=100", true), true)
    assert.equal(empty.data.length, 0); assert.equal(empty.meta.total, 13)
    const mixed = await repo.save(admin, randomUUID(), categoryInput({ ...input, name: "Mixed formats", phases: [
      { id: "mixed", label: "Mixed", shortLabel: "Mixed", types: ["Technical", "Situational", "Coding"], count: 4 },
    ] }), "category") as Category
    const responseDefinition = { format: "multiple_choice", options: [{ id: "a", text: "0" }, { id: "b", text: "1" }], correctOptionId: "b" }
    const coding = await repo.save(admin, randomUUID(), questionInput({ question: "Trace this code", type: "Coding", hint: "", feedback: "", responseDefinition }), "question", undefined, mixed.id) as Question
    for (const type of ["Technical", "Situational"]) await repo.save(admin, randomUUID(), questionInput({ question: "Choose one", type, hint: "", feedback: "", responseDefinition }), "question", undefined, mixed.id)
    await repo.save(admin, randomUUID(), questionInput({ question: "Explain your solution", type: "Coding", hint: "", feedback: "Explain correctness and tradeoffs." }), "question", undefined, mixed.id)
    const savedCoding = (await createBankRepository(pool).list(admin, query(), true, mixed.id)).data.find(q => q.id === coding.id) as Question
    assert.deepEqual(savedCoding.responseDefinition, responseDefinition)
    const preview = await repo.pipeline(student, mixed.id)
    assert.equal(preview[0].questions.length, 4)
    assert.equal(preview[0].questions.filter(q => q.responseDefinition.format === "multiple_choice").length, 3)
    assert.equal(preview[0].questions.filter(q => q.responseDefinition.format === "written").length, 1)
    assert.ok(!JSON.stringify(preview).includes("correctOptionId"))
    assert.ok(!JSON.stringify(preview).includes("feedback"))
    assert.deepEqual(preview[0].questions.find(q => q.id === coding.id)?.responseDefinition, { format: "multiple_choice", options: responseDefinition.options })
    for (const patch of [{ type: "Behavioral" }, { feedback: "MCQ explanation" }, { responseDefinition: { format: "written" } }])
      await assert.rejects(repo.save(admin, randomUUID(), questionInput(patch, true), "question", coding.id), { code: "VALIDATION_ERROR" })
    const updatedDefinition = { ...responseDefinition, correctOptionId: "a", options: [{ id: "a", text: "Updated output" }, responseDefinition.options[1]] }
    await repo.save(admin, randomUUID(), questionInput({ responseDefinition: updatedDefinition }, true), "question", coding.id)
    assert.deepEqual(((await repo.list(admin, query(), true, mixed.id)).data.find(q => q.id === coding.id) as Question).responseDefinition, updatedDefinition)
    await repo.save(admin, randomUUID(), questionInput({ responseDefinition: { format: "written" }, status: "inactive" }, true), "question", coding.id)
    await assert.rejects(repo.save(admin, randomUUID(), questionInput({ status: "active" }, true), "question", coding.id), { code: "VALIDATION_ERROR" })
    await assert.rejects(repo.pipeline(student, mixed.id), { code: "CATEGORY_UNAVAILABLE" })
    await repo.save(admin, randomUUID(), questionInput({ status: "active", feedback: "Explain the code output." }, true), "question", coding.id)
    await assert.rejects(repo.save(admin, randomUUID(), questionInput({ responseDefinition }, true), "question", coding.id), { code: "VALIDATION_ERROR" })
    await repo.save(admin, randomUUID(), questionInput({ responseDefinition, feedback: "" }, true), "question", coding.id)
    assert.equal((await repo.pipeline(student, mixed.id))[0].questions.length, 4)
    await db.exec("reset role; revoke insert on gethired_private.audit_events from gethired_runtime; set role gethired_runtime")
    await assert.rejects(repo.save(admin, randomUUID(), { question: "Must roll back" }, "question", question.id), { code: "SERVICE_UNAVAILABLE" })
    assert.equal(((await repo.list(admin, query(), true, cat.id)).data[0] as Question).question, "Updated intro")
    await db.exec("reset role; update gethired_private.accounts set status='inactive' where role='admin'; set role gethired_runtime")
    await assert.rejects(repo.list(admin, query(), true), { code: "SESSION_EXPIRED" })
    await db.exec("reset role; set role anon")
    for (const table of ["categories", "questions"]) await assert.rejects(db.query(`select * from gethired_private.${table}`))
  } finally { await db.close() }
})

test("question rules require active written rubrics and prohibit MCQ explanations and unsupported types", () => {
  const base = { question: "Question", type: "Technical", hint: "", feedback: "" }
  const responseDefinition = { format: "multiple_choice", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctOptionId: "a" }
  assert.throws(() => questionInput(base), { code: "VALIDATION_ERROR" })
  assert.equal(questionInput({ ...base, status: "inactive" }).status, "inactive")
  for (const type of ["Technical", "Situational", "Coding"])
    assert.equal(questionInput({ ...base, type, responseDefinition }).type, type)
  for (const type of ["Introduction", "Behavioral", "Motivational", "Design Challenge", "Candidate Questions"])
    assert.throws(() => questionInput({ ...base, type, responseDefinition }), { code: "VALIDATION_ERROR" })
  assert.throws(() => questionInput({ ...base, responseDefinition, feedback: "Explanation" }), { code: "VALIDATION_ERROR" })
  assert.throws(() => questionInput({ ...base, responseDefinition: { ...responseDefinition, correctOptionId: "missing" } }), { code: "VALIDATION_ERROR" })
  assert.throws(() => questionInput({ responseDefinition: { correctOptionId: "b" } }, true), { code: "VALIDATION_ERROR" })
})
