"use client";

import { useEffect, useState } from "react";
import { apiClient, isSessionError } from "@/lib/api-client";

export default function SessionRecovery({ path, unavailable = false }: { path: "/dashboard" | "/admin"; unavailable?: boolean }) {
  const [error, setError] = useState(unavailable ? "The service is temporarily unavailable. Please try again." : "");
  useEffect(() => {
    if (unavailable) return;
    let active = true;
    apiClient.refresh().then(() => {
      if (active) window.location.replace(path);
    }).catch((failure: unknown) => {
      if (!active) return;
      if (isSessionError(failure)) window.location.replace("/login");
      else setError(failure instanceof Error ? failure.message : "Please try again.");
    });
    return () => { active = false; };
  }, [path, unavailable]);
  return <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
    <h1 className="text-2xl font-semibold">{error ? "Unable to load your workspace" : "Checking your session…"}</h1>
    {error && <><p role="alert">{error}</p><button className="rounded-xl bg-blue-600 px-5 py-3 text-white" onClick={() => window.location.reload()}>Try again</button></>}
    <a href="/login" className="text-blue-600">Back to sign in</a>
  </main>;
}
