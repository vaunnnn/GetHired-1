"use client";

import { useEffect, useState } from "react";
import { apiClient, isSessionError } from "@/lib/api-client";
import type { CurrentUser } from "@gethired/contracts";
import AuthenticatedWorkspace from "./AuthenticatedWorkspace";

export default function SessionRecovery({
  role,
  unavailable = false,
}: {
  role: "student" | "admin";
  unavailable?: boolean;
}) {
  const [current, setCurrent] = useState<CurrentUser | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(
    unavailable
      ? "The service is temporarily unavailable. Please try again."
      : "",
  );
  useEffect(() => {
    if (current || (unavailable && attempt === 0)) return;
    let active = true;
    let revision = 0,
      pending = false;
    const recover = () => {
      if (pending || !active) return;
      pending = true;
      const startedRevision = revision;
      setError("");
      apiClient
        .refresh()
        .then((next) => {
          if (active && revision === startedRevision) setCurrent(next);
        })
        .catch((failure: unknown) => {
          if (!active || revision !== startedRevision) return;
          if (isSessionError(failure)) window.location.replace("/login");
          else
            setError(
              failure instanceof Error ? failure.message : "Please try again.",
            );
        })
        .finally(() => {
          pending = false;
          if (active && revision !== startedRevision) recover();
        });
    };
    const unsubscribe = apiClient.subscribeSessionChanges((reason) => {
      if (reason === "denied") {
        active = false;
        window.location.replace("/login");
        return;
      }
      revision++;
      recover();
    });
    recover();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [attempt, unavailable, current]);
  if (current) return <AuthenticatedWorkspace role={role} initial={current} />;
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">
        {error ? "Unable to load your workspace" : "Checking your session…"}
      </h1>
      {error && (
        <>
          <p role="alert">{error}</p>
          <button
            className="rounded-xl bg-blue-600 px-5 py-3 text-white"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </button>
        </>
      )}
      <a href="/login" className="text-blue-600">
        Back to sign in
      </a>
    </main>
  );
}
