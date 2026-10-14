"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { CurrentUser } from "@gethired/contracts";
import { apiClient, isSessionError } from "@/lib/api-client";

const SessionContext = createContext<(CurrentUser & { logout: () => Promise<void> }) | null>(null);

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("SessionProvider is required.");
  return session;
}

export default function SessionProvider({ initial, children }: { initial: CurrentUser; children: ReactNode }) {
  const [current, setCurrent] = useState(initial);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const loggingOut = useRef(false);
  useEffect(() => {
    let active = true;
    let pending = false;
    const check = async () => {
      if (pending || document.visibilityState === "hidden" || loggingOut.current) return;
      pending = true;
      // Routine revalidation must not interrupt an already authenticated workspace.
      // API requests still enforce authorization; failures block the UI below.
      try {
        const next = await apiClient.me();
        if (!active || loggingOut.current) return;
        if (next.user.id !== initial.user.id || next.user.role !== initial.user.role) {
          window.location.reload();
          return;
        }
        setCurrent(next);
        setError("");
      } catch (failure) {
        if (!active || loggingOut.current) return;
        if (isSessionError(failure)) window.location.replace("/login");
        setError(failure instanceof Error ? failure.message : "Unable to verify your session.");
      } finally { pending = false; }
    };
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("gethired-session");
    if (channel) channel.onmessage = () => { void check(); };
    const onVisible = () => { void check(); };
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onVisible, 60000);
    void check();
    return () => {
      active = false; channel?.close(); window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [initial.user.id, initial.user.role]);

  async function logout() {
    if (loggingOut.current) return;
    loggingOut.current = true;
    setChecking(true);
    try { await apiClient.logout(); window.location.replace("/login"); }
    catch (failure) {
      setError(failure instanceof Error ? failure.message : "Sign out failed. Please try again.");
      loggingOut.current = false;
      setChecking(false);
    }
  }

  return <SessionContext.Provider value={{ ...current, logout }}>
    <div className="contents" inert={!!error || checking} aria-hidden={!!error || checking}>{children}</div>
    {(error || checking) && <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-white p-6 text-center" role="status">
      <p>{error || "Checking your session…"}</p>
      {error && <button className="rounded-xl bg-blue-600 px-5 py-3 text-white" onClick={() => window.location.reload()}>Try again</button>}
    </div>}
  </SessionContext.Provider>;
}
