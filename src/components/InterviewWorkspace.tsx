"use client" /* Browser recovery is optional; the server remains authoritative. */ /* The unload warning still protects unsaved input if storage is unavailable. */
// Resolve uncertain responses without resubmitting or triggering a second evaluation.
/* Keep the local answer and original error. */ /* Storage is optional. */ /* Server persistence still works. */ /* Storage is optional. */

import { useCallback, useEffect, useRef, useState } from "react"
import type {
  AttemptAnswer,
  AttemptQuestion,
  AttemptSummary,
  Category,
  InterviewAttempt,
} from "@gethired/contracts"
import CategoryCard from "./CategoryCard"
import { useSession } from "./SessionProvider"
import { apiClient, ApiClientError } from "@/lib/api-client"
import {
  bankList,
  categoryView,
  type InterviewCategory,
} from "@/lib/interviews"
import {
  practiceAnswerText,
  validPracticeAnswer,
} from "@/lib/interview-answers"

const base = "/api/me/interview-attempts"
const button =
  "rounded-full bg-[#0073ff] px-6 py-3 text-sm font-semibold text-white disabled:opacity-40"
const secondary =
  "rounded-full border border-gray-200 px-5 py-3 text-sm text-gray-600 disabled:opacity-40"
const card = "rounded-[24px] bg-white p-6 shadow-sm"
const message = (e: unknown) =>
  e instanceof
  Error
    ? e.message
    : "Unable to save. Please try again."

function AnswerEditor({
  attemptId,
  question,
  onSaved,
  onContinue,
  onExit,
}: {
  attemptId: string
  question: AttemptQuestion
  onSaved: (saved: AttemptAnswer) => void
  onContinue: () => Promise<void>
  onExit: () => void
}) {
  const draftKey = `gethired-draft:${attemptId}:${question.id}`
  const [recovery] = useState(() => {
    try {
      const value = JSON.parse(
        sessionStorage.getItem(draftKey) ??
          "null",
      )
      if (
        question.saved.status ===
          "draft" &&
        typeof value?.answer ===
          "string" &&
        value.answer.length <=
          20000 &&
        Number.isSafeInteger(value.revision)
      )
        return value as { answer: string; revision: number }
    } catch {}
    return null
  })
  const [answer, setAnswer] = useState(
    recovery?.answer ??
      question.saved.answer,
  )
  const [saved, setSaved] = useState(question.saved)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(
    recovery &&
      recovery.revision !==
        question.saved.revision
      ? "Your recovered draft differs from a newer saved revision. Copy your text before loading the saved answer."
      : "",
  )
  const [conflict, setConflict] = useState(
    !!recovery &&
      recovery.revision !==
        question.saved.revision,
  )
  const conflictRef = useRef(conflict)
  conflictRef.current = conflict
  const current = useRef(question.saved)
  const input = useRef(answer)
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const locked = useRef(false)
  const mounted = useRef(true)
  const callbacks = useRef({ onSaved, onExit })
  callbacks.current = { onSaved, onExit }
  const path = `${base}/${attemptId}/answers/${question.id}`
  const preserve = useCallback(() => {
    if (conflictRef.current) return
    try {
      if (
        current.current.status ===
          "draft" &&
        input.current !==
          current.current.answer
      )
        sessionStorage.setItem(
          draftKey,
          JSON.stringify({
            answer: input.current,
            revision: current.current.revision,
          }),
        )
      else sessionStorage.removeItem(draftKey)
    } catch {}
  }, [draftKey])
  const accept = useCallback(
    (value: AttemptAnswer) => {
      current.current = value
      preserve()
      if (mounted.current) {
        setSaved(value)
        callbacks.current.onSaved(value)
      }
    },
    [preserve],
  )
  const flush = useCallback(() => {
    const work = chain.current
      .catch(() => {})
      .then(async () => {
        if (
          current.current.status !==
            "draft" ||
          input.current ===
            current.current.answer
        )
          return
        if (conflictRef.current)
          throw new Error(
            "Load the saved answer to resolve the revision conflict.",
          )
        preserve()
        if (mounted.current) setSaving(true)
        try {
          const next = await apiClient.mutate<AttemptAnswer>(path, "PUT", {
            answer: input.current,
            revision: current.current.revision,
          })
          accept(next)
          if (mounted.current) setError("")
        } catch (e) {
          if (mounted.current) {
            setError(message(e))
            if (
              e instanceof
                ApiClientError &&
              ["ANSWER_CONFLICT", "ANSWER_LOCKED"].includes(e.code)
            ) {
              conflictRef.current = true
              setConflict(true)
            }
          }
          throw e
        } finally {
          if (mounted.current) setSaving(false)
        }
      })
    chain.current = work
    return work
  }, [path, accept, preserve])
  useEffect(() => {
    if (
      saved.status !==
        "draft" ||
      busy ||
      conflict ||
      answer ===
        saved.answer
    )
      return
    const timer = setTimeout(
      () => {
        void flush().catch(() => {})
      },
      question.responseDefinition.format ===
        "multiple_choice"
        ? 0
        : 800,
    )
    return () => clearTimeout(timer)
  }, [answer, saved, busy, conflict, flush, question.responseDefinition.format])
  useEffect(() => {
    mounted.current = true
    const warn = (event: BeforeUnloadEvent) => {
      preserve()
      if (
        current.current.status ===
          "draft" &&
        input.current !==
          current.current.answer
      ) {
        event.preventDefault()
        event.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", warn)
    return () => {
      preserve()
      mounted.current = false
      window.removeEventListener("beforeunload", warn)
      void flush().catch(() => {})
    }
  }, [flush, preserve])
  async function reload() {
    const latest = await apiClient.get<InterviewAttempt>(`${base}/${attemptId}`)
    const q = latest.questions.find(
      (q) =>
        q.id ===
        question.id,
    )
    if (q) {
      accept(q.saved)
      return q.saved
    }
    throw new Error("This question is unavailable.")
  }
  async function submit() {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError("")
    try {
      await flush()
      const result = await apiClient.mutate<AttemptAnswer>(
        `${path}/submit`,
        "POST",
        { answer: input.current, revision: current.current.revision },
      )
      accept(result)
    } catch (e) {
      setError(message(e))
      if (
        e instanceof
          ApiClientError &&
        e.code ===
          "ANSWER_CONFLICT"
      ) {
        conflictRef.current = true
        setConflict(true)
      }
      try {
        const latest = await reload()
        if (latest.status === "evaluated") setError("")
      } catch {}
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function action(work: () => Promise<void>) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError("")
    try {
      await work()
    } catch (e) {
      setError(message(e))
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const editable = saved.status === "draft" && !busy && !conflict
  return (
    <div className="space-y-4">
      <button
        className={secondary}
        disabled={busy}
        onClick={() =>
          action(async () => {
            await flush()
            callbacks.current.onExit()
          })
        }
      >
        Back to categories
      </button>
      <div className={card}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#0073ff]">
          {question.phaseLabel} · {question.type}
        </p>
        <h2 className="whitespace-pre-wrap text-lg font-semibold text-[#302929]">
          {question.question}
        </h2>
        {question.hint && (
          <p className="mt-4 rounded-xl bg-[#dfe9ff] p-4 text-sm text-[#0073ff]">
            {question.hint}
          </p>
        )}
      </div>
      <div className={card}>
        <label
          id="answer-label"
          htmlFor="interview-answer"
          className="mb-4 block font-semibold"
        >
          Your answer
        </label>
        {saved.status === "evaluated" ? (
          <p className="whitespace-pre-wrap break-words text-sm text-gray-600">
            {practiceAnswerText(question, saved.answer)}
          </p>
        ) : question.responseDefinition.format === "multiple_choice" ? (
          <fieldset
            aria-labelledby="answer-label"
            disabled={!editable}
            className="space-y-3"
          >
            {question.responseDefinition.options.map((option) => (
              <label
                key={option.id}
                className={`flex gap-3 rounded-xl border p-4 ${
                  answer === option.id
                    ? "border-[#0073ff] bg-blue-50"
                    : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name="interview-option"
                  value={option.id}
                  checked={answer === option.id}
                  onChange={() => {
                    input.current = option.id
                    setAnswer(option.id)
                  }}
                />
                <span className="whitespace-pre-wrap text-sm">
                  {option.text}
                </span>
              </label>
            ))}
          </fieldset>
        ) : (
          <textarea
            id="interview-answer"
            aria-labelledby="answer-label"
            value={answer}
            disabled={!editable}
            maxLength={20000}
            rows={question.type === "Coding" ? 10 : 7}
            onChange={(e) => {
              input.current = e.target.value
              setAnswer(e.target.value)
            }}
            placeholder={
              question.type === "Candidate Questions"
                ? "What would you ask the interviewer?"
                : "Write your answer here…"
            }
            className={`w-full resize-y rounded-xl border border-gray-200 p-4 text-sm outline-[#0073ff] ${
              question.type === "Coding" ? "font-mono" : ""
            }`}
          />
        )}
        <div role="status" className="mt-3 text-xs text-gray-500">
          {busy
            ? "Please wait…"
            : saving
              ? "Saving…"
              : saved.status === "draft"
                ? answer === saved.answer
                  ? "Draft saved"
                  : "Unsaved changes"
                : saved.status === "evaluating"
                  ? "Evaluation in progress"
                  : saved.status === "failed"
                    ? "Answer saved. Evaluation needs a retry."
                    : "Answer and score saved"}
        </div>
        {saved.status === "draft" &&
          question.responseDefinition.format === "written" && (
            <p className="mt-2 text-xs text-gray-400">
              {answer.length} / 20,000 characters · Minimum{" "}
              {question.type === "Candidate Questions" ? 1 : 20} characters
            </p>
          )}
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
          {conflict && (
            <>
              <p className="mt-2">
                Your local text is still shown. Copy it if needed before loading
                the saved answer.
              </p>
              <button
                className={secondary}
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    const latest = await reload()
                    input.current = latest.answer
                    setAnswer(latest.answer)
                    conflictRef.current = false
                    setConflict(false)
                    preserve()
                  })
                }
              >
                Load saved answer
              </button>
            </>
          )}
          {!conflict && saved.status === "draft" && (
            <button
              className="ml-3 underline"
              disabled={busy}
              onClick={() =>
                action(async () => {
                  await flush()
                })
              }
            >
              Retry saving
            </button>
          )}
        </div>
      )}
      {saved.status === "evaluated" ? (
        <>
          <div className="rounded-[24px] bg-[#4869ff] p-6 text-white">
            <p className="text-3xl font-semibold">{saved.score}/100</p>
            <p className="mt-3 whitespace-pre-wrap text-sm">{saved.feedback}</p>
            <p className="mt-3 text-xs text-white/70">
              {question.responseDefinition.format === "written"
                ? "AI practice feedback"
                : "Answer-key grading"}{" "}
              · Submitted answers cannot be changed.
            </p>
          </div>
          <button
            className={button}
            disabled={busy}
            onClick={() => action(onContinue)}
          >
            Continue
          </button>
        </>
      ) : (
        <button
          className={button}
          disabled={busy || conflict || !validPracticeAnswer(question, answer)}
          onClick={submit}
        >
          {busy
            ? "Evaluating…"
            : saved.status === "draft"
              ? "Next question"
              : "Retry evaluation"}
        </button>
      )}
    </div>
  )
}

export default function InterviewWorkspace({
  cache,
}: {
  cache: { current: { rows: InterviewCategory[]; at: number } | null }
}) {
  const { user } = useSession()
  const resumeKey = `gethired-interview:${user.id}`
  const [categories, setCategories] = useState<InterviewCategory[]>([])
  const [attempt, setAttempt] = useState<InterviewAttempt | null>(null)
  const [index, setIndex] = useState(0)
  const [history, setHistory] = useState<AttemptSummary[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const lock = useRef(false)
  useEffect(() => {
    let live = true
    let id: string | null = null
    try {
      id = sessionStorage.getItem(resumeKey)
    } catch {}
    if (id && /^[0-9a-f-]{36}$/i.test(id)) {
      lock.current = true
      setBusy(true)
      apiClient
        .get<InterviewAttempt>(`${base}/${id}`)
        .then((value) => {
          if (live) show(value)
        })
        .catch((e) => {
          if (live) setError(message(e))
        })
        .finally(() => {
          if (live) {
            lock.current = false
            setBusy(false)
          }
        })
    }
    return () => {
      live = false
    }
  }, [resumeKey])
  useEffect(() => {
    let live = true
    setLoading(true)
    setError("")
    const age = cache.current ? Date.now() - cache.current.at : Infinity
    const cached = age >= 0 && age < 30000
    const cats =
      cached
        ? Promise.resolve(cache.current!.rows)
        : bankList<Category>("/api/categories").then((rows) =>
            rows.map(categoryView),
          )
    Promise.all([
      cats,
      apiClient.list<AttemptSummary>(`${base}?page=${page}&pageSize=10`),
    ])
      .then(([rows, history]) => {
        if (!live) return
        setCategories(rows)
        if (!cached) cache.current = { rows, at: Date.now() }
        setHistory(history.data)
        setTotal(history.meta?.total ?? 0)
      })
      .catch((e) => {
        if (live) setError(message(e))
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [cache, page, revision])
  function show(value: InterviewAttempt) {
    try {
      sessionStorage.setItem(resumeKey, value.id)
    } catch {}
    setAttempt(value)
    const next = value.questions.findIndex(
      (q) => q.saved.status !== "evaluated",
    )
    setIndex(next < 0 ? Math.max(0, value.questions.length - 1) : next)
  }
  async function run(work: () => Promise<void>) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError("")
    try {
      await work()
    } catch (e) {
      setError(message(e))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const start = (categoryId: string, restartAttemptId?: string) =>
    run(async () => {
      show(
        await apiClient.mutate<InterviewAttempt>(base, "POST", {
          categoryId,
          ...(restartAttemptId ? { restartAttemptId } : {}),
        }),
      )
    })
  const exit = () => {
    try {
      sessionStorage.removeItem(resumeKey)
    } catch {}
    setAttempt(null)
    setRevision((r) => r + 1)
  }
  const finished = attempt && attempt.status !== "in_progress"
  return (
    <div>
      <h1
        className="mb-2 text-[38px] tracking-[-1px] text-[#302929]"
        style={{ fontFamily: "'DM Serif Display', serif" }}
      >
        Mock Interview Practice
      </h1>
      {error && (
        <p
          role="alert"
          className="my-4 rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error}{" "}
          <button
            className="underline"
            onClick={() => setRevision((r) => r + 1)}
          >
            Reload
          </button>
        </p>
      )}
      {!attempt ? (
        <>
          <p className="mb-6 text-sm text-gray-500">
            Choose a category to start or resume. Drafts save automatically.
            Each submitted answer receives a score before you continue.
          </p>
          {loading ? (
            <p role="status">Loading interviews…</p>
          ) : (
            <>
              {!categories.length && (
                <p>No interview categories are available yet.</p>
              )}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className={busy ? "pointer-events-none opacity-50" : ""}
                  >
                    <CategoryCard
                      category={cat}
                      pipeline={cat.pipeline}
                      onSelect={() => start(cat.id)}
                    />
                  </div>
                ))}
              </div>
              <h2 className="mb-4 mt-8 text-xl font-semibold">
                Saved interviews
              </h2>
              {!history.length && (
                <p className="text-sm text-gray-500">
                  Your interviews will appear here.
                </p>
              )}
              <div className="space-y-3">
                {history.map((item) => (
                  <button
                    key={item.id}
                    disabled={busy}
                    onClick={() =>
                      run(async () =>
                        show(
                          await apiClient.get<InterviewAttempt>(
                            `${base}/${item.id}`,
                          ),
                        ),
                      )
                    }
                    className={`${card} flex w-full items-center justify-between gap-3 text-left`}
                  >
                    <span>
                      <span className="block font-semibold">
                        {item.categoryName}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(item.createdAt).toLocaleDateString()} ·{" "}
                        {item.status === "in_progress"
                          ? "Resume interview"
                          : item.status === "completed"
                            ? "Completed"
                            : "Abandoned"}
                      </span>
                    </span>
                    <span className="font-semibold text-[#0073ff]">
                      {item.score === null ? "Open →" : `${item.score}/100`}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  className={secondary}
                  disabled={busy || page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span className="text-sm">Page {page}</span>
                <button
                  className={secondary}
                  disabled={busy || page * 10 >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </>
      ) : finished ? (
        <>
          <button className={`${secondary} my-4`} onClick={exit}>
            Back to categories
          </button>
          <div className="mb-5 rounded-[28px] bg-[#4869ff] p-7 text-white">
            <h2 className="text-2xl font-semibold">{attempt.categoryName}</h2>
            <p className="mt-2 text-3xl">
              {attempt.score === null
                ? "Abandoned interview"
                : `${attempt.score}/100`}
            </p>
            <p className="mt-2 text-sm">
              {attempt.status === "completed"
                ? "Interview complete · All questions weighted equally"
                : "Saved responses are available below."}
            </p>
          </div>
          <div className="space-y-4">
            {attempt.questions.map((q) => (
              <div key={q.id} className={card}>
                <p className="text-xs text-[#0073ff]">
                  {q.phaseLabel} · {q.type}
                </p>
                <h3 className="my-3 whitespace-pre-wrap font-semibold">
                  {q.question}
                </h3>
                <p className="whitespace-pre-wrap break-words text-sm text-gray-600">
                  {practiceAnswerText(q, q.saved.answer) || "No answer saved"}
                </p>
                <p className="mt-4 font-semibold">
                  {q.saved.score === null
                    ? "Not evaluated"
                    : `${q.saved.score}/100`}
                </p>
                {q.saved.feedback && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                    {q.saved.feedback}
                  </p>
                )}
              </div>
            ))}
          </div>
          <button
            className={`${button} mt-5`}
            disabled={busy}
            onClick={() => start(attempt.categoryId)}
          >
            Practice this category again
          </button>
        </>
      ) : attempt.questions[index] ? (
        <>
          <div className="mb-5 flex items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              {attempt.categoryName} · Question {index + 1} of{" "}
              {attempt.questions.length}
            </p>
            <button
              className={secondary}
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Abandon this interview and start a new one? Saved responses will remain in history.",
                  )
                )
                  void start(attempt.categoryId, attempt.id)
              }}
            >
              Start over
            </button>
          </div>
          <AnswerEditor
            key={`${attempt.id}:${attempt.questions[index].id}`}
            attemptId={attempt.id}
            question={attempt.questions[index]}
            onExit={exit}
            onSaved={(saved) =>
              setAttempt((current) =>
                current
                  ? {
                      ...current,
                      questions: current.questions.map((q, i) =>
                        i === index ? { ...q, saved } : q,
                      ),
                    }
                  : current,
              )
            }
            onContinue={async () => {
              if (index + 1 < attempt.questions.length) setIndex((i) => i + 1)
              else
                show(
                  await apiClient.mutate<InterviewAttempt>(
                    `${base}/${attempt.id}/complete`,
                    "POST",
                    {},
                  ),
                )
            }}
          />
        </>
      ) : (
        <p>This interview has no assigned questions.</p>
      )}
    </div>
  )
}
