"use client"

// Each mounted hook owns its private data. No shared session or response cache.
/* Status / Metadata Text */ /* Action Controls */
import { useCallback, useEffect, useRef, useState } from "react"
import type { PaginationMeta } from "@gethired/contracts"
import { apiClient } from "@/lib/api-client"
export function useCompanyPage<T>(
  path: string,
  query = "",
  revision = 0,
  enabled = true,
) {
  const queryKey = path + "?" + query
  const [position, setPosition] = useState({ key: queryKey, page: 1 })
  if (position.key !== queryKey) setPosition({ key: queryKey, page: 1 })
  const page = position.key === queryKey ? position.page : 1
  const setPage = useCallback(
    (next: number) => setPosition({ key: queryKey, page: next }),
    [queryKey],
  )
  const [state, setState] = useState<{
    data: T[]
    meta: PaginationMeta
    loading: boolean
    error: string
  }>({
    data: [],
    meta: { page: 1, pageSize: 20, total: 0 },
    loading: enabled,
    error: "",
  })
  const [retry, setRetry] = useState(0)
  const latest = useRef(0)
  const previous = useRef<{
    path: string
    query: string
    revision: number
    retry: number
    enabled: boolean
  } | null>(null)
  const fulfilled = useRef({ key: "", at: 0 })
  useEffect(() => {
    const version = ++latest.current
    const before = previous.current
    previous.current = { path, query, revision, retry, enabled }
    if (!enabled) return
    const key = JSON.stringify([path, query, page, revision, retry])
    const age = Date.now() - fulfilled.current.at
    if (fulfilled.current.key === key && age >= 0 && age < 30000) {
      setState((s) => ({ ...s, loading: false, error: "" }))
      return
    }
    const filters = (value: string) => {
      const p = new URLSearchParams(value)
      p.delete("q")
      p.sort()
      return p.toString()
    }
    const textOnly =
      before?.enabled &&
      before.path === path &&
      before.revision === revision &&
      before.retry === retry &&
      new URLSearchParams(before.query).get("q") !==
        new URLSearchParams(query).get("q") &&
      filters(before.query) === filters(query)
    setState((s) => ({ ...s, loading: true, error: "" }))
    const load = () => {
      void apiClient
        .list<T>(`${path}?${query}&page=${page}`)
        .then((result) => {
          if (version === latest.current) {
            fulfilled.current = { key, at: Date.now() }
            setState({
              data: result.data,
              meta: result.meta!,
              loading: false,
              error: "",
            })
          }
        })
        .catch((error) => {
          if (version === latest.current)
            setState((s) => ({
              ...s,
              loading: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Unable to load companies.",
            }))
        })
    }
    const timer = textOnly ? setTimeout(load, 180) : undefined
    if (!textOnly) load()
    return () => {
      clearTimeout(timer)
      latest.current++
    }
  }, [path, query, page, revision, retry, enabled])
  const reload = useCallback(() => setRetry((n) => n + 1), [])
  return { ...state, page, setPage, reload }
}

const RefreshIcon = ({ spin = false }: { spin?: boolean }) => (
  <svg
    width={13}
    height={13}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={spin ? "animate-spin" : ""}
  >
    <path d="M21.5 2v6h-6M2.5 22v-6h6" />
    <path d="M21.5 15.5a9 9 0 0 1-14.85 4.35L2.5 16M2.5 8.5a9 9 0 0 1 14.85-4.35L21.5 8" />
  </svg>
)

const ChevronLeft = () => (
  <svg
    width={13}
    height={13}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
)

const ChevronRight = () => (
  <svg
    width={13}
    height={13}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

export default function CompanyResults({
  loading,
  error,
  meta,
  page,
  setPage,
  reload,
  partnerLabel = "accredited industry partners",
}: {
  loading: boolean
  error: string
  meta: PaginationMeta
  page: number
  setPage: (page: number) => void
  reload: () => void
  partnerLabel?: string
}) {
  const totalPages = Math.max(1, Math.ceil(meta.total / (meta.pageSize || 20)))

  return (
    <div
      className="my-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl px-4 sm:px-6 py-3 shadow-2xs text-[13px]"
      aria-live="polite"
    >
      {/* Status / Metadata Text */}
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-[#0066FF] animate-ping" />
            <span role="status">Updating partner directory…</span>
          </div>
        ) : error ? (
          <div
            className="flex items-center gap-2 text-red-600 font-medium"
            role="alert"
          >
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>{error}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap text-slate-600">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#EEF5FF] text-[#0066FF] font-semibold text-[12px]">
              {meta.total}
            </span>
            <span className="font-semibold text-slate-700">{partnerLabel}</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400 text-[12.5px] font-medium">
              Page {page} of {totalPages}
            </span>
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-slate-800 border border-slate-200/80 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
          title={error ? "Retry loading" : "Refresh list"}
        >
          <RefreshIcon spin={loading} />
          <span>{error ? "Retry" : "Refresh"}</span>
        </button>

        <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

        <button
          type="button"
          disabled={loading || page <= 1}
          onClick={() => setPage(page - 1)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200/80 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
          title="Previous page"
        >
          <ChevronLeft />
          <span className="hidden sm:inline">Previous</span>
        </button>

        <span className="px-3 py-1 text-[11.5px] font-semibold text-slate-700 bg-slate-100/90 rounded-full">
          {page} / {totalPages}
        </span>

        <button
          type="button"
          disabled={loading || !!error || page >= totalPages}
          onClick={() => setPage(page + 1)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200/80 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
          title="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight />
        </button>
      </div>
    </div>
  )
}
