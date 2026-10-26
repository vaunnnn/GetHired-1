"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PaginationMeta } from "@gethired/contracts";
import { apiClient } from "@/lib/api-client";

// Each mounted hook owns its private data. No shared session or response cache.
export function useCompanyPage<T>(
  path: string,
  query = "",
  revision = 0,
  enabled = true,
) {
  const queryKey = path + "?" + query;
  const [position, setPosition] = useState({ key: queryKey, page: 1 });
  if (position.key !== queryKey) setPosition({ key: queryKey, page: 1 });
  const page = position.key === queryKey ? position.page : 1;
  const setPage = useCallback(
    (next: number) => setPosition({ key: queryKey, page: next }),
    [queryKey],
  );
  const [state, setState] = useState<{
    data: T[];
    meta: PaginationMeta;
    loading: boolean;
    error: string;
  }>({
    data: [],
    meta: { page: 1, pageSize: 20, total: 0 },
    loading: enabled,
    error: "",
  });
  const [retry, setRetry] = useState(0);
  const latest = useRef(0);
  const previous = useRef<{
    path: string;
    query: string;
    revision: number;
    retry: number;
    enabled: boolean;
  } | null>(null);
  const fulfilled = useRef({ key: "", at: 0 });
  useEffect(() => {
    const version = ++latest.current;
    const before = previous.current;
    previous.current = { path, query, revision, retry, enabled };
    if (!enabled) return;
    const key = JSON.stringify([path, query, page, revision, retry]);
    const age = Date.now() - fulfilled.current.at;
    if (fulfilled.current.key === key && age >= 0 && age < 30000) {
      setState((s) => ({ ...s, loading: false, error: "" }));
      return;
    }
    const filters = (value: string) => {
      const p = new URLSearchParams(value);
      p.delete("q");
      p.sort();
      return p.toString();
    };
    const textOnly =
      before?.enabled &&
      before.path === path &&
      before.revision === revision &&
      before.retry === retry &&
      new URLSearchParams(before.query).get("q") !==
        new URLSearchParams(query).get("q") &&
      filters(before.query) === filters(query);
    setState((s) => ({ ...s, loading: true, error: "" }));
    const load = () => {
      void apiClient
        .list<T>(`${path}?${query}&page=${page}`)
        .then((result) => {
          if (version === latest.current) {
            fulfilled.current = { key, at: Date.now() };
            setState({
              data: result.data,
              meta: result.meta!,
              loading: false,
              error: "",
            });
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
            }));
        });
    };
    const timer = textOnly ? setTimeout(load, 180) : undefined;
    if (!textOnly) load();
    return () => {
      clearTimeout(timer);
      latest.current++;
    };
  }, [path, query, page, revision, retry, enabled]);
  const reload = useCallback(() => setRetry((n) => n + 1), []);
  return { ...state, page, setPage, reload };
}

export default function CompanyResults({
  loading,
  error,
  meta,
  page,
  setPage,
  reload,
}: {
  loading: boolean;
  error: string;
  meta: PaginationMeta;
  page: number;
  setPage: (page: number) => void;
  reload: () => void;
}) {
  return (
    <div
      className="my-3 flex flex-wrap items-center gap-3 text-sm"
      aria-live="polite"
    >
      {loading ? (
        <span role="status">Loading companies…</span>
      ) : error ? (
        <span role="alert">{error}</span>
      ) : (
        <span>
          {meta.total} results · Page {page} of{" "}
          {Math.max(1, Math.ceil(meta.total / meta.pageSize))}
        </span>
      )}
      <button
        type="button"
        onClick={reload}
        className="text-blue-600 underline"
      >
        {error ? "Retry" : "Refresh"}
      </button>
      <button
        type="button"
        disabled={loading || page <= 1}
        onClick={() => setPage(page - 1)}
        className="disabled:opacity-40"
      >
        Previous
      </button>
      <button
        type="button"
        disabled={loading || !!error || page * meta.pageSize >= meta.total}
        onClick={() => setPage(page + 1)}
        className="disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
