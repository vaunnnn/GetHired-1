"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CurrentUser } from "@gethired/contracts";
import { apiClient } from "@/lib/api-client";
import { createSessionRevalidation } from "@/lib/session-revalidation";

const SessionContext = createContext<
  (CurrentUser & { logout: () => Promise<void> }) | null
>(null);

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("SessionProvider is required.");
  return session;
}

export default function SessionProvider({
  initial,
  children,
}: {
  initial: CurrentUser;
  children: ReactNode;
}) {
  const [current, setCurrent] = useState(initial);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [denied, setDenied] = useState(false);
  const loggingOut = useRef(false);
  const revalidation = useRef<ReturnType<
    typeof createSessionRevalidation
  > | null>(null);
  useEffect(() => {
    const checker = createSessionRevalidation({
      initial,
      read: () => apiClient.me(),
      onCurrent(next) {
        setCurrent(next);
        setError("");
      },
      onDenied() {
        setDenied(true);
        window.location.replace("/login");
      },
      onAccountChange(next) {
        setDenied(true);
        window.location.replace(
          next.user.role === "admin" ? "/admin" : "/dashboard",
        );
      },
      onUnavailable(failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Unable to verify your session. Please try again.",
        );
      },
    });
    revalidation.current = checker;
    const onVisible = () => {
      if (document.visibilityState !== "hidden" && !loggingOut.current)
        void checker.check();
    };
    const unsubscribe = apiClient.subscribeSessionChanges((reason) => {
      if (reason === "denied") {
        checker.stop();
        setDenied(true);
        window.location.replace("/login");
        return;
      }
      checker.invalidate();
      if (!loggingOut.current) void checker.check();
    });
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onVisible, 60000);
    void checker.check();
    // Initial is authoritative from SSR or successful recovery; no duplicate mount read.
    return () => {
      checker.stop();
      revalidation.current = null;
      unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [initial]);

  async function logout() {
    if (loggingOut.current) return;
    loggingOut.current = true;
    setChecking(true);
    try {
      await apiClient.logout();
      window.location.replace("/login");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Sign out failed. Please try again.",
      );
      loggingOut.current = false;
      setChecking(false);
      void revalidation.current?.check(true);
    }
  }

  if (denied)
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        role="status"
      >
        Returning to your sign-in page…
      </main>
    );
  return (
    <SessionContext.Provider value={{ ...current, logout }}>
      <div className="contents" inert={checking} aria-hidden={checking}>
        {children}
      </div>
      {error && !checking && (
        <aside
          role="alert"
          className="fixed bottom-4 right-4 z-[100] max-w-md rounded-xl border border-amber-300 bg-white p-4 shadow-lg"
        >
          <p>{error}</p>
          <button
            className="mt-2 font-semibold text-blue-600"
            onClick={() => {
              void revalidation.current?.check(true);
            }}
          >
            Try again
          </button>
        </aside>
      )}
      {checking && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-white p-6 text-center"
          role="status"
        >
          Signing you out…
        </div>
      )}
    </SessionContext.Provider>
  );
}
