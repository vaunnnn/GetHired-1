import type { ReactNode } from "react";
import { getPageSession } from "@/server/session";
import SessionProvider from "./SessionProvider";
import SessionRecovery from "./SessionRecovery";

export default async function ProtectedPage({ role, children }: { role: "student" | "admin"; children: ReactNode }) {
  const result = await getPageSession();
  const path = role === "admin" ? "/admin" : "/dashboard";
  if (result.kind !== "authenticated") return <SessionRecovery path={path} unavailable={result.kind === "unavailable"} />;
  if (result.current.user.role !== role) return <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
    <h1 className="text-2xl font-semibold">Access denied</h1>
    <p>Your account does not have access to this workspace.</p>
    <a className="text-blue-600" href={result.current.user.role === "admin" ? "/admin" : "/dashboard"}>Go to your workspace</a>
  </main>;
  return <SessionProvider initial={result.current}>{children}</SessionProvider>;
}
