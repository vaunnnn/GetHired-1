"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PaginationMeta } from "@gethired/contracts";
import { apiClient } from "@/lib/api-client";

export function useCompanyPage<T>(path: string, query = "", revision = 0) {
  const [page, setPage] = useState(1);
  const [state, setState] = useState<{ data: T[]; meta: PaginationMeta; loading: boolean; error: string }>({ data: [], meta: { page: 1, pageSize: 20, total: 0 }, loading: true, error: "" });
  const [retry, setRetry] = useState(0);
  const latest = useRef(0);
  const previousQuery = useRef(query);
  useEffect(() => {
    const version = ++latest.current;
    if (previousQuery.current !== query) { previousQuery.current = query; setPage(1); if (page !== 1) return; }
    setState(s => ({ ...s, data: [], loading: true, error: "" }));
    const timer = setTimeout(() => {
      void apiClient.list<T>(`${path}?${query}&page=${page}`).then(result => {
        if (version === latest.current) setState({ data: result.data, meta: result.meta!, loading: false, error: "" });
      }).catch(error => { if (version === latest.current) setState(s => ({ ...s, loading: false, error: error instanceof Error ? error.message : "Unable to load companies." })); });
    }, 180);
    return () => { clearTimeout(timer); latest.current++; };
  }, [path, query, page, revision, retry]);
  const reload = useCallback(() => setRetry(n => n + 1), []);
  return { ...state, page, setPage, reload };
}

export default function CompanyResults({ loading, error, meta, page, setPage, reload }: {
  loading: boolean; error: string; meta: PaginationMeta; page: number; setPage: (page: number) => void; reload: () => void;
}) {
  return <div className="my-3 flex flex-wrap items-center gap-3 text-sm" aria-live="polite">
    {loading ? <span role="status">Loading companies…</span> : error ? <span role="alert">{error}</span> : <span>{meta.total} results · Page {page} of {Math.max(1, Math.ceil(meta.total / meta.pageSize))}</span>}
    <button type="button" onClick={reload} className="text-blue-600 underline">{error ? "Retry" : "Refresh"}</button>
    <button type="button" disabled={loading || page <= 1} onClick={() => setPage(page - 1)} className="disabled:opacity-40">Previous</button>
    <button type="button" disabled={loading || !!error || page * meta.pageSize >= meta.total} onClick={() => setPage(page + 1)} className="disabled:opacity-40">Next</button>
  </div>;
}
