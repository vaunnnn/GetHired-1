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
  "rounded-full bg-[#0066FF] hover:bg-[#0052cc] px-6 py-2.5 text-[13.5px] font-semibold text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
const secondary =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white hover:border-[#0066FF] hover:text-[#0066FF] px-4 py-2 text-[12.5px] font-semibold text-slate-600 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs active:scale-98"
const card = "rounded-2xl bg-white p-6 border border-slate-200/80 shadow-xs"
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Unable to save. Please try again."

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
      const value = JSON.parse(sessionStorage.getItem(draftKey) ?? "null")
      if (
        question.saved.status === "draft" &&
        typeof value?.answer === "string" &&
        value.answer.length <= 20000 &&
        Number.isSafeInteger(value.revision)
      )
        return value as { answer: string; revision: number }
    } catch {}
    return null
  })
  const [answer, setAnswer] = useState(
    recovery?.answer ?? question.saved.answer,
  )
  const [saved, setSaved] = useState(question.saved)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(
    recovery && recovery.revision !== question.saved.revision
      ? "Your recovered draft differs from a newer saved revision. Copy your text before loading the saved answer."
      : "",
  )
  const [conflict, setConflict] = useState(
    !!recovery && recovery.revision !== question.saved.revision,
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
        current.current.status === "draft" &&
        input.current !== current.current.answer
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
          current.current.status !== "draft" ||
          input.current === current.current.answer
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
              e instanceof ApiClientError &&
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
    if (saved.status !== "draft" || busy || conflict || answer === saved.answer)
      return
    const timer = setTimeout(
      () => {
        void flush().catch(() => {})
      },
      question.responseDefinition.format === "multiple_choice" ? 0 : 800,
    )
    return () => clearTimeout(timer)
  }, [answer, saved, busy, conflict, flush, question.responseDefinition.format])
  useEffect(() => {
    mounted.current = true
    const warn = (event: BeforeUnloadEvent) => {
      preserve()
      if (
        current.current.status === "draft" &&
        input.current !== current.current.answer
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
    const q = latest.questions.find((q) => q.id === question.id)
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
      if (e instanceof ApiClientError && e.code === "ANSWER_CONFLICT") {
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
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
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
    const cats = cached
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
          {/* Top Instruction Pill */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2.5 bg-[#EEF5FF] text-[#0066FF] border border-[#0066FF]/20 px-4 py-2 rounded-full text-[13px] font-medium shadow-2xs">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>Choose a category to start or resume practice. Drafts save automatically.</span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-slate-500 py-12 justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0066FF] animate-ping" />
              <span role="status" className="text-[14px]">Loading interview categories…</span>
            </div>
          ) : (
            <>
              {/* Practice Categories Section */}
              <div className="mb-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-[18px] font-bold text-slate-800">
                      Practice Categories
                    </h2>
                    {categories.length > 0 && (
                      <span className="text-[12px] font-semibold text-[#0066FF] bg-[#EEF5FF] border border-[#0066FF]/20 px-2.5 py-0.5 rounded-full">
                        {categories.length}
                      </span>
                    )}
                  </div>
                </div>

                {!categories.length ? (
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-8 sm:p-10 text-center flex flex-col items-center justify-center shadow-xs">
                    <div className="w-12 h-12 rounded-2xl bg-[#EEF5FF] text-[#0066FF] flex items-center justify-center mb-3 shadow-2xs">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                      </svg>
                    </div>
                    <h3 className="text-[16px] font-bold text-slate-800 mb-1">
                      No interview categories available
                    </h3>
                    <p className="text-[13px] text-slate-500 max-w-sm leading-relaxed">
                      Interview categories and question sets will appear here once published by DCISM.
                    </p>
                  </div>
                ) : (
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
                )}
              </div>

              {/* Saved Interviews Section */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-[18px] font-bold text-slate-800">
                      Saved Interviews
                    </h2>
                    {total > 0 && (
                      <span className="text-[12px] font-semibold text-[#0066FF] bg-[#EEF5FF] border border-[#0066FF]/20 px-2.5 py-0.5 rounded-full">
                        {total}
                      </span>
                    )}
                  </div>
                </div>

                {!history.length ? (
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-8 sm:p-10 text-center flex flex-col items-center justify-center shadow-xs">
                    <div className="w-12 h-12 rounded-2xl bg-[#EEF5FF] text-[#0066FF] flex items-center justify-center mb-2.5 shadow-2xs">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                      </svg>
                    </div>
                    <h4 className="text-[15px] font-bold text-slate-800 mb-0.5">
                      No interview history yet
                    </h4>
                    <p className="text-[12.5px] text-slate-400">
                      Your mock interview attempts and feedback will be saved here.
                    </p>
                  </div>
                ) : (
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
                        className="group w-full bg-white border border-slate-200/80 hover:border-[#0066FF]/40 rounded-2xl p-4 sm:p-5 transition-all hover:shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left cursor-pointer active:scale-[0.99]"
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                              <polyline points="10 9 9 9 8 9" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-[15px] text-slate-800 group-hover:text-[#0066FF] transition-colors truncate">
                              {item.categoryName}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              {item.status === "completed" && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Completed
                                </span>
                              )}
                              {item.status === "in_progress" && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  In Progress
                                </span>
                              )}
                              {item.status === "abandoned" && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                  Abandoned
                                </span>
                              )}
                              <span className="text-[12px] text-slate-400">
                                {new Date(item.createdAt).toLocaleDateString(
                                  undefined,
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          {item.score !== null ? (
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                                  Score
                                </span>
                                <span className="text-[16px] font-bold text-[#0066FF]">
                                  {item.score}/100
                                </span>
                              </div>
                              <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center group-hover:bg-[#0066FF] group-hover:text-white group-hover:border-[#0066FF] transition-all">
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="9 18 15 12 9 6" />
                                </svg>
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold bg-[#0066FF] text-white shadow-2xs group-hover:bg-[#0052cc] transition-all">
                              {item.status === "in_progress"
                                ? "Resume"
                                : "Review"}
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Pagination Controls */}
                {total > 0 && (
                  <div className="mt-5 pt-4 border-t border-slate-200/70 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-[12.5px] text-slate-500">
                      Showing{" "}
                      <span className="font-semibold text-slate-700">
                        {(page - 1) * 10 + 1}
                      </span>
                      –
                      <span className="font-semibold text-slate-700">
                        {Math.min(page * 10, total)}
                      </span>{" "}
                      of{" "}
                      <span className="font-semibold text-slate-700">
                        {total}
                      </span>{" "}
                      saved {total === 1 ? "interview" : "interviews"}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 text-[12.5px] font-semibold hover:border-[#0066FF] hover:text-[#0066FF] disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-600 transition-all cursor-pointer disabled:cursor-not-allowed shadow-2xs active:scale-98"
                        disabled={busy || page === 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                        Previous
                      </button>
                      <span className="px-3 py-1 rounded-full text-[12px] font-semibold bg-slate-100 text-slate-600">
                        Page {page}
                      </span>
                      <button
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 text-[12.5px] font-semibold hover:border-[#0066FF] hover:text-[#0066FF] disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-600 transition-all cursor-pointer disabled:cursor-not-allowed shadow-2xs active:scale-98"
                        disabled={busy || page * 10 >= total}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      ) : finished ? (
        <>
          <button className={`${secondary} my-4`} onClick={exit}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
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
