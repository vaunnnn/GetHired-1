// Real multi-connection audit. Creates/drops ONLY a generated local database.
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { setTimeout as delay } from "node:timers/promises"
import { performance } from "node:perf_hooks"
import { Pool } from "pg"
import { createAuthStore } from "../apps/api/src/auth/store.js"
import type { Principal } from "../apps/api/src/auth/types.js"
import { createAttemptRepository } from "../apps/api/src/modules/interviews/attempt-repository.js"
import { createBankRepository } from "../apps/api/src/modules/interviews/repository.js"
import { providerSchema, migrations } from "../apps/api/tests/support/phase2-database.js"
import type { Category } from "@gethired/contracts"

const target = new URL(process.env.INTERVIEW_POSTGRES_URL ?? "postgresql://postgres@127.0.0.1:55433/postgres")
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname), "Only a local disposable PostgreSQL instance is allowed")
assert.equal(target.search, "", "Connection query overrides are not allowed")
const database = `gethired_interview_${randomUUID().replaceAll("-", "")}`
const admin = new Pool({ connectionString: target.toString(), connectionTimeoutMillis: 3000 })
let operator: Pool | undefined, runtime: Pool | undefined, created = false
const evidence: any = { timestamp: new Date().toISOString(), environment: "disposable-local", runtimePoolMax: 5, provider: "simulated; no Gemini requests", checks: [], lockObservations: [], load: [], passed: false }
const output = `docs/performance/interview-postgres-${Date.now()}.json`
let studentNumber = 87000000
const limits = { minute: 10000, day: 10000 }

async function session(userId: string) {
  const sessionId = randomUUID()
  await operator!.query("insert into auth.sessions values ($1,$2,null)", [sessionId, userId])
  await operator!.query("insert into auth.refresh_tokens values ($1,false)", [sessionId])
  return createAuthStore(runtime!).createSession({ userId, sessionId }, false)
}
async function actor(role: "admin" | "student") {
  const userId = randomUUID(), id = randomUUID()
  await operator!.query("insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now())", [userId, `${id}@example.test`])
  await operator!.query("insert into gethired_private.accounts(id,auth_user_id,email,display_name,role,status) values ($1,$2,$3,'Audit',$4,'active')", [id, userId, `${id}@example.test`, role])
  if (role === "student") await operator!.query("insert into gethired_private.student_profiles values ($1,$2,'Audit','Student','BSCS','4')", [id, String(studentNumber++)])
  return session(userId)
}
async function run(label: string, work: () => Promise<void>) {
  await work()
  evidence.checks.push(label)
  console.log(`PASS: ${label}`)
}
// Hold a real lock until every independent backend is observed waiting in PostgreSQL.
async function race<T>(label: string, lockSql: string, values: unknown[], jobs: (() => Promise<T>)[]) {
  const locker = await operator!.connect()
  let pending: Promise<PromiseSettledResult<T>[]> | undefined
  try {
    await locker.query("begin")
    await locker.query(lockSql, values)
    pending = Promise.allSettled(jobs.map(work => work()))
    const deadline = Date.now() + 3000
    let waiting: number[] = []
    do {
      waiting = (await operator!.query("select pid from pg_stat_activity where application_name='gethired-interview-audit' and wait_event_type='Lock'", [])).rows.map(r => r.pid)
      if (waiting.length >= jobs.length) break
      await delay(15)
    } while (Date.now() < deadline)
    assert.equal(new Set(waiting).size, jobs.length, `${label}: all jobs must wait on distinct PostgreSQL backends`)
    evidence.lockObservations.push({ label, simultaneousWaitingBackends: waiting.length })
    await locker.query("commit")
    return await pending
  } finally {
    await locker.query("rollback")
    await pending
    locker.release()
  }
}
function successes<T>(results: PromiseSettledResult<T>[]) {
  return results.filter((r): r is PromiseFulfilledResult<T> => r.status === "fulfilled").map(r => r.value)
}
function errors(results: PromiseSettledResult<unknown>[]) {
  return results.filter((r): r is PromiseRejectedResult => r.status === "rejected").map(r => r.reason?.code ?? "UNKNOWN")
}
function distribution(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return { samples: values.length, medianMs: sorted[Math.ceil(sorted.length * .5) - 1] ?? null, p95Ms: sorted[Math.ceil(sorted.length * .95) - 1] ?? null, maxMs: sorted.at(-1) ?? null }
}

try {
  await admin.query(`create database ${database}`)
  created = true
  target.pathname = `/${database}`
  operator = new Pool({ connectionString: target.toString(), max: 3, connectionTimeoutMillis: 3000 })
  await operator.query(providerSchema)
  for (const migration of [...migrations, "202610280001_interview_attempts.sql"])
    await operator.query(await readFile(`supabase/migrations/${migration}`, "utf8"))
  runtime = new Pool({ connectionString: target.toString(), options: "-c role=gethired_runtime", application_name: "gethired-interview-audit", max: 5, connectionTimeoutMillis: 5000 })
  evidence.postgresVersion = (await operator.query("show server_version")).rows[0].server_version
  const repo = createAttemptRepository(runtime), bank = createBankRepository(runtime)
  const owner = await actor("student"), editor = await actor("admin")
  const peers = [owner]
  for (let i = 1; i < 5; i++) peers.push(await session(owner.identity.userId))
  const category = await bank.save(editor, randomUUID(), {
    name: "Local concurrency audit", description: "Synthetic only", color: "#0073ff", bg: "#ffffff",
    phases: [{ id: "written", label: "Written", shortLabel: "Written", types: ["Technical"], count: 1 }, { id: "mcq", label: "Coding", shortLabel: "Coding", types: ["Coding"], count: 1 }],
  }, "category") as Category
  await bank.save(editor, randomUUID(), { question: "Describe safe database transactions.", type: "Technical", hint: "", feedback: "Explain atomicity and isolation.", responseDefinition: { format: "written" } }, "question", undefined, category.id)
  await bank.save(editor, randomUUID(), { question: "Choose B", type: "Coding", hint: "", feedback: "", responseDefinition: { format: "multiple_choice", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctOptionId: "b" } }, "question", undefined, category.id)
  const attemptLock = "select id from gethired_private.interview_attempts where id=$1 for update"
  let attempt = await repo.start(owner, category.id)
  await run("concurrent starts across five sessions return one unfinished attempt", async () => {
    // The first attempt already exists; also test the no-existing-attempt path for a fresh owner.
    const fresh = await actor("student"), freshPeers = [fresh]
    for (let i = 1; i < 5; i++) freshPeers.push(await session(fresh.identity.userId))
    const results = await race("start advisory lock", "select pg_advisory_xact_lock(hashtextextended($1,0))", [`interview:${fresh.id}:${category.id}`], freshPeers.map(p => () => repo.start(p, category.id)))
    assert.deepEqual(errors(results), [])
    assert.equal(new Set(successes(results).map(a => a.id)).size, 1)
    assert.equal((await operator!.query("select count(*)::int as n from gethired_private.interview_attempts where account_id=$1 and category_id=$2 and status='in_progress'", [fresh.id, category.id])).rows[0].n, 1)
  })
  let answer = "", revision = 0
  await run("conflicting drafts accept one revision and reject four stale writes", async () => {
    const results = await race("draft row lock", attemptLock, [attempt.id], peers.map((p, i) => () => repo.save(p, attempt.id, attempt.questions[0].id, `Synthetic transaction answer number ${i}.`, 0)))
    assert.equal(successes(results).length, 1)
    assert.deepEqual(errors(results), Array(4).fill("ANSWER_CONFLICT"))
    answer = successes(results)[0].answer
    revision = successes(results)[0].revision
    assert.equal(revision, 1)
    assert.equal((await repo.get(owner, attempt.id)).questions[0].saved.answer, answer)
  })
  let evaluationToken = ""
  await run("five written submissions claim one evaluation and consume one budget unit", async () => {
    const results = await race("evaluation claim lock", attemptLock, [attempt.id], peers.map(p => () => repo.claim(p, attempt.id, attempt.questions[0].id, answer, revision, limits)))
    assert.equal(successes(results).length, 1)
    assert.deepEqual(errors(results), Array(4).fill("EVALUATION_PENDING"))
    evaluationToken = successes(results)[0].work!.token
    assert.equal((await operator!.query("select day_count from gethired_private.interview_evaluation_budget where scope='gemini'")).rows[0].day_count, 1)
    assert.equal(runtime!.idleCount, runtime!.totalCount, "Provider work must not retain a pooled connection")
    await assert.rejects(repo.complete(owner, attempt.id), { code: "ATTEMPT_INCOMPLETE" })
  })
  await run("expired evaluation lease has one replacement; stale result cannot overwrite it", async () => {
    await operator!.query("update gethired_private.attempt_answers set evaluation_started_at=clock_timestamp()-interval '2 minutes' where question_id=$1", [attempt.questions[0].id])
    const claims = await race("expired evaluation claim lock", attemptLock, [attempt.id], peers.map(p => () => repo.claim(p, attempt.id, attempt.questions[0].id, answer, revision, limits)))
    assert.equal(successes(claims).length, 1)
    assert.deepEqual(errors(claims), Array(4).fill("EVALUATION_PENDING"))
    const replacement = successes(claims)[0].work!.token
    assert.notEqual(replacement, evaluationToken)
    const results = await race("evaluation settlement lock", attemptLock, [attempt.id], peers.map((p, i) => () => repo.settle(p, attempt.id, attempt.questions[0].id, i === 0 ? replacement : evaluationToken, { score: i === 0 ? 80 : 99, feedback: "Synthetic evaluation", model: "local-test" })))
    assert.equal(successes(results).length, 1)
    assert.deepEqual(errors(results), Array(4).fill("CONFLICT"))
    assert.equal((await repo.get(owner, attempt.id)).questions[0].saved.score, 80)
  })
  await run("duplicate MCQ submissions grade once and return identical stored results", async () => {
    const results = await race("MCQ submission lock", attemptLock, [attempt.id], peers.map(p => () => repo.claim(p, attempt.id, attempt.questions[1].id, "b", 0, limits)))
    assert.deepEqual(errors(results), [])
    for (const result of successes(results)) { assert.deepEqual(result, successes(results)[0]); assert.equal(result.result!.score, 100); assert.equal(result.result!.revision, 1) }
  })
  await run("completion races preserve one immutable result and reject answer edits", async () => {
    const results = await race<unknown>("completion and save lock", attemptLock, [attempt.id], peers.map((p, i) => i < 3 ? () => repo.complete(p, attempt.id) : () => repo.save(p, attempt.id, attempt.questions[1].id, "a", 1)))
    assert.equal(successes(results).length, 3)
    assert.equal(errors(results).length, 2)
    assert.ok(errors(results).every(code => ["ANSWER_LOCKED", "ATTEMPT_COMPLETED"].includes(code)))
    const done = await repo.get(owner, attempt.id)
    assert.equal(done.status, "completed"); assert.equal(done.score, 90)
    for (const result of successes(results)) assert.deepEqual(result, done)
    assert.deepEqual(await repo.complete(owner, attempt.id), done)
  })
  await run("concurrent restarts abandon one old attempt and create one replacement", async () => {
    attempt = await repo.start(owner, category.id)
    const results = await race("restart advisory lock", "select pg_advisory_xact_lock(hashtextextended($1,0))", [`interview:${owner.id}:${category.id}`], peers.map(p => () => repo.start(p, category.id, attempt.id)))
    assert.deepEqual(errors(results), [])
    assert.equal(new Set(successes(results).map(a => a.id)).size, 1)
    assert.notEqual(successes(results)[0].id, attempt.id)
    assert.equal((await repo.get(owner, attempt.id)).status, "abandoned")
    assert.equal((await operator!.query("select count(*)::int as n from gethired_private.interview_attempts where account_id=$1 and category_id=$2 and status='in_progress'", [owner.id, category.id])).rows[0].n, 1)
  })
  await run("completion racing the final submission never persists an incomplete score", async () => {
    const current = await repo.start(owner, category.id)
    const text = "Synthetic final-submission race answer about transactions."
    const claim = await repo.claim(owner, current.id, current.questions[0].id, text, 0, limits)
    await repo.settle(owner, current.id, current.questions[0].id, claim.work!.token, { score: 80, feedback: "Synthetic", model: "local-test" })
    const results = await race<unknown>("final submission and completion lock", attemptLock, [current.id], peers.map((p, i) => i < 2
      ? () => repo.claim(p, current.id, current.questions[1].id, "b", 0, limits)
      : () => repo.complete(p, current.id)))
    assert.equal(results[0].status, "fulfilled")
    assert.equal(results[1].status, "fulfilled")
    assert.ok(errors(results).every(code => code === "ATTEMPT_INCOMPLETE"))
    const done = await repo.complete(owner, current.id)
    assert.equal(done.score, 90)
    assert.equal(done.status, "completed")
    assert.ok(done.questions.every(q => q.saved.status === "evaluated"))
    for (const result of results.slice(2)) if (result.status === "fulfilled") assert.deepEqual(result.value, done)
  })
  const workers: Principal[] = []
  for (let i = 0; i < 5; i++) workers.push(await actor("student"))
  for (const concurrency of [1, 2, 5]) {
    const durations: number[] = [], failures: string[] = [], operations: Record<string, number[]> = {}
    let maxPoolWaiters = 0
    const started = performance.now()
    await Promise.all(workers.slice(0, concurrency).map(async worker => {
      for (let iteration = 0; iteration < 30; iteration++) {
        const before = performance.now()
        const measure = async <T>(name: string, work: () => Promise<T>) => {
          maxPoolWaiters = Math.max(maxPoolWaiters, runtime!.waitingCount)
          const at = performance.now()
          const result = await work()
          ;(operations[name] ??= []).push(performance.now() - at)
          return result
        }
        try {
          const current = await measure("start", () => repo.start(worker, category.id))
          const text = "Synthetic load answer about atomicity and isolation."
          const saved = await measure("save", () => repo.save(worker, current.id, current.questions[0].id, text, 0))
          const claim = await measure("claim", () => repo.claim(worker, current.id, current.questions[0].id, text, saved.revision, limits))
          assert.ok(claim.work)
          await delay(10) // Controlled provider latency; no external requests.
          await measure("settle", () => repo.settle(worker, current.id, current.questions[0].id, claim.work!.token, { score: 80, feedback: "Synthetic", model: "local-test" }))
          await measure("mcq", () => repo.claim(worker, current.id, current.questions[1].id, "b", 0, limits))
          const complete = await measure("complete", () => repo.complete(worker, current.id))
          assert.equal(complete.score, 90)
          const read = await measure("read", () => repo.get(worker, current.id))
          assert.deepEqual(read, complete)
          durations.push(performance.now() - before)
        } catch (error) { failures.push((error as { code?: string }).code ?? "ASSERTION_OR_UNKNOWN"); break }
      }
    }))
    const elapsedMs = performance.now() - started
    const sample = { concurrency, iterationsPerWorker: 30, attempted: durations.length + failures.length, successful: durations.length, failures, elapsedMs, flowsPerSecond: durations.length / (elapsedMs / 1000), flowLatency: distribution(durations), operationLatency: Object.fromEntries(Object.entries(operations).map(([name, samples]) => [name, distribution(samples)])), maxPoolWaiters, rawSuccessfulFlowMs: durations }
    evidence.load.push(sample)
    console.log(`LOAD: ${concurrency} workers, ${durations.length} flows, ${failures.length} failures, p95 ${sample.flowLatency.p95Ms?.toFixed(1)} ms`)
    assert.deepEqual(failures, [])
    assert.equal(durations.length, concurrency * 30)
  }
  evidence.passed = true
} catch (error) {
  evidence.failure = error instanceof Error ? error.message : "Unknown audit failure"
  process.exitCode = 1
} finally {
  await runtime?.end()
  await operator?.end()
  if (created) await admin.query(`drop database ${database} with (force)`)
  await admin.end()
  evidence.disposableDatabaseRemoved = created
  await writeFile(output, JSON.stringify(evidence, null, 2) + "\n", { flag: "wx" })
  console.log(`Evidence: ${output}`)
  if (!evidence.passed) console.error(evidence.failure)
}
