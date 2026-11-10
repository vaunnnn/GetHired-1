// Hosted staging acceptance. Call only with explicit authorization to create data.
// request(role, path, method?, body?) must use authenticated, isolated cookie jars
// against the approved Vercel origin and return { status, data, error, meta }.
// Credentials and cookies belong in caller memory, never in this file or report.
import assert from "node:assert/strict"

const written = (type, question, feedback, answer) => ({
  input: { type, question, feedback, hint: "Use a concrete example.", status: "active", responseDefinition: { format: "written" } },
  answer,
})
const mcq = (type, question, options, correctOptionId, answer) => ({
  input: { type, question, feedback: "", hint: "Choose one answer.", status: "active", responseDefinition: { format: "multiple_choice", options: options.map((text, i) => ({ id: `option${i}`, text })), correctOptionId } },
  answer,
})

export const acceptanceQuestions = [
  written("Introduction", "For this fictional practice exercise, introduce yourself as a student who built a task-list website. Describe your contribution and one thing learned.", "Assess a clear student introduction, specific personal contribution to a task-list website, and a concrete learning outcome. Weight all three equally.", "In this fictional example, I am a computing student who built a task-list website. I implemented task creation and completion with React state. I learned to use stable identifiers so editing one task does not change another."),
  written("Situational", "A teammate reports that saving a task sometimes fails. How would you investigate and communicate progress?", "Assess reproducible investigation, checking network/server evidence without exposing secrets, and clear communication of findings and next steps. Weight all three equally.", "I would ask for reproduction steps, reproduce with synthetic data, and inspect the network response and server request identifier. I would check validation and connectivity, avoid sharing secrets, and tell my teammate what I confirmed and when I will report the next result."),
  written("Technical", "Explain the difference between HTTP 401 and 403 in an authenticated web application.", "Assess that 401 means missing or invalid authentication, 403 means insufficient authorization, and examples or client handling are appropriate. Weight all three equally.", "HTTP 401 indicates that authentication is missing or invalid, such as an expired session, so the client can prompt for login. HTTP 403 indicates that access is forbidden, such as a student requesting an administrator endpoint; logging in again does not grant that permission."),
  mcq("Technical", "Which JavaScript operator compares values without type coercion?", ["===", "==", "="], "option0", "option0"),
  mcq("Coding", "What is printed by: const values = [1, 2]; console.log(values.map(x => x * 2).join(','));", ["1,2", "2,4", "2,3"], "option1", "option0"),
  written("Candidate Questions", "Ask a thoughtful question about mentoring during a web-development internship.", "Assess relevance to mentoring, specificity, and curiosity about learning or feedback. Weight all three equally.", "How are interns paired with mentors, and how often can I receive feedback on code reviews and progress toward my learning goals?"),
]

export async function runHostedAcceptance(request, report, onProgress = () => {}) {
  const check = async (role, path, method = "GET", body, code) => {
    const result = await request(role, path, method, body)
    if (code) assert.equal(result.error?.code, code, `${method} ${path}`)
    else assert.ok(result.status >= 200 && result.status < 300, `${method} ${path}: ${result.status} ${result.error?.code ?? ""}`)
    // Normalize JSON envelopes from callers running in a separate VM realm.
    return JSON.parse(JSON.stringify(result))
  }
  const safe = attempt => {
    for (const q of attempt.questions) {
      assert.equal("correctOptionId" in q.responseDefinition, false)
      assert.equal("feedback" in q, false)
      assert.equal("rubric" in q, false)
      assert.equal("response_definition" in q, false)
    }
    for (const q of acceptanceQuestions.filter(q => q.input.feedback))
      assert.equal(JSON.stringify(attempt).includes(q.input.feedback), false)
  }
  report.startedAt = new Date().toISOString()
  report.checks = []
  report.evaluations = []
  report.browserVerification = "Pending: HTTP acceptance does not verify browser rendering, debounce, or refresh UI."
  let categoryId
  try {
    const bank = await check("admin", "/api/admin/categories?page=1&pageSize=100")
    report.existingCategoryCount = bank.meta.total
    if (report.categoryId) {
      const existing = bank.data.find(item => item.id === report.categoryId)
      assert.ok(existing?.name.startsWith("Staging acceptance "), "Only resume a previously created acceptance category")
    }
    const category = report.categoryId ? { data: { id: report.categoryId } } : await check("admin", "/api/admin/categories", "POST", {
      name: `Staging acceptance ${report.startedAt.slice(0, 19).replaceAll(":", "-")}`,
      description: "Synthetic hosted interview acceptance. Deactivate after verification; retain results as evidence.",
      color: "#0073ff", bg: "#dfe9ff", status: "inactive",
      phases: [
        { id: "intro", label: "Introduction", shortLabel: "Intro", types: ["Introduction"], count: 1 },
        { id: "situational", label: "Situational", shortLabel: "Situational", types: ["Situational"], count: 1 },
        { id: "technical", label: "Technical", shortLabel: "Technical", types: ["Technical"], count: 2 },
        { id: "coding", label: "Practical Challenge", shortLabel: "Practical", types: ["Coding"], count: 1 },
        { id: "your-questions", label: "Your Questions", shortLabel: "Q&A", types: ["Candidate Questions"], count: 1 },
      ],
    })
    categoryId = category.data.id
    if (!report.categoryId) {
      for (const fixture of acceptanceQuestions)
        await check("admin", `/api/admin/categories/${categoryId}/questions`, "POST", fixture.input)
    }
    report.categoryId = categoryId
    const stored = await check("admin", `/api/admin/categories/${categoryId}/questions?page=1&pageSize=100`)
    assert.equal(stored.data.length, acceptanceQuestions.length)
    for (const fixture of acceptanceQuestions) {
      const match = stored.data.find(item => item.question === fixture.input.question)
      assert.ok(match)
      for (const key of Object.keys(fixture.input)) assert.deepEqual(match[key], fixture.input[key])
    }
    await check("admin", `/api/admin/categories/${categoryId}`, "PATCH", { status: "active" })
    report.checks.push("Six reviewed questions persisted through admin API; category activated after population")
    onProgress("Created six synthetic questions; beginning student attempt")

    const base = "/api/me/interview-attempts"
    const started = await check("student", base, "POST", { categoryId })
    const attempt = started.data
    report.attemptId = attempt.id
    assert.equal(attempt.questions.length, 6)
    safe(attempt)
    const detail = `${base}/${attempt.id}`
    await check("admin", detail, "GET", undefined, "FORBIDDEN")
    await check("student", `${detail}/complete`, "POST", {}, "ATTEMPT_INCOMPLETE")
    assert.equal((await check("student", base, "POST", { categoryId })).data.id, attempt.id)
    report.checks.push("Student-safe snapshots; admin denied student attempt; premature completion blocked; start resumes same attempt")

    for (const q of attempt.questions) {
      const fixture = acceptanceQuestions.find(item => item.input.question === q.question)
      assert.ok(fixture)
      const path = `${detail}/answers/${q.id}`
      const saved = (await check("student", path, "PUT", { answer: fixture.answer, revision: q.saved.revision })).data
      const unchanged = (await check("student", path, "PUT", { answer: fixture.answer, revision: saved.revision })).data
      assert.equal(unchanged.revision, saved.revision)
      const resumed = (await check("student", detail)).data
      safe(resumed)
      assert.equal(resumed.questions.find(item => item.id === q.id).saved.answer, fixture.answer)
      // The first written draft also exercises stale-write and blank-submission rejection.
      if (q === attempt.questions[0]) {
        await check("student", path, "PUT", { answer: fixture.answer + " changed", revision: q.saved.revision }, "ANSWER_CONFLICT")
        await check("student", `${path}/submit`, "POST", { answer: "", revision: saved.revision }, "VALIDATION_ERROR")
      }
      const before = Date.now()
      const graded = (await check("student", `${path}/submit`, "POST", { answer: fixture.answer, revision: saved.revision })).data
      assert.equal(graded.status, "evaluated")
      assert.ok(Number.isInteger(graded.score) && graded.score >= 0 && graded.score <= 100)
      assert.ok(graded.feedback?.length)
      if (fixture.input.responseDefinition.format === "multiple_choice")
        assert.equal(graded.score, fixture.answer === fixture.input.responseDefinition.correctOptionId ? 100 : 0)
      report.evaluations.push({ type: q.type, format: q.responseDefinition.format, score: graded.score, durationMs: Date.now() - before })
      await check("student", path, "PUT", { answer: fixture.answer, revision: graded.revision }, "ANSWER_LOCKED")
      const replay = (await check("student", `${path}/submit`, "POST", { answer: fixture.answer, revision: graded.revision })).data
      assert.deepEqual(replay, graded)
      onProgress(`Verified ${q.type} ${q.responseDefinition.format}: score ${graded.score}, persisted and locked`)
    }
    const completed = (await check("student", `${detail}/complete`, "POST", {})).data
    assert.equal(completed.status, "completed")
    const expected = Math.round(report.evaluations.reduce((n, q) => n + q.score, 0) / 6 * 100) / 100
    assert.equal(completed.score, expected)
    safe(completed)
    assert.deepEqual((await check("student", `${detail}/complete`, "POST", {})).data, completed)
    assert.deepEqual((await check("student", detail)).data, completed)
    const history = await check("student", `${base}?page=1&pageSize=100`)
    assert.ok(history.data.some(item => item.id === attempt.id && item.score === expected && item.status === "completed"))
    await check("student", `${detail}/answers/${completed.questions[0].id}`, "PUT", { answer: "changed", revision: completed.questions[0].saved.revision }, "ATTEMPT_COMPLETED")
    report.overallScore = expected
    report.checks.push("Draft persistence and unchanged-write stability", "Stale write and blank submission rejected", "Four real written evaluations and correct/incorrect MCQ grading", "Answer locking and idempotent evaluation replay", "Equal-weight score, immutable completion, detail retrieval and saved history")
    report.httpAcceptance = "passed"
  } catch (error) {
    report.httpAcceptance = "failed"
    report.failure = error.message
    throw error
  } finally {
    if (categoryId) {
      const deactivated = await request("admin", `/api/admin/categories/${categoryId}`, "PATCH", { status: "inactive" })
      report.categoryDeactivated = deactivated.status === 200 && deactivated.data?.status === "inactive"
      if (!report.categoryDeactivated) throw new Error("Test category deactivation requires attention")
      const visible = await request("student", "/api/categories?page=1&pageSize=100")
      assert.equal(visible.status, 200)
      assert.equal(visible.data.some(item => item.id === categoryId), false)
      report.checks.push("Test category deactivated and absent from student category list")
    }
    report.finishedAt = new Date().toISOString()
  }
}
