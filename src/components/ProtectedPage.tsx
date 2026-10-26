import { getPageSession } from "@/server/session";
import SessionRecovery from "./SessionRecovery";
import AuthenticatedWorkspace from "./AuthenticatedWorkspace";

export default async function ProtectedPage({ role }: { role: "student" | "admin" }) {
  const result = await getPageSession();
  if (result.kind !== "authenticated") return <SessionRecovery role={role} unavailable={result.kind === "unavailable"} />;
  if (result.current.user.role !== role) return <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
    <h1 className="text-2xl font-semibold">Access denied</h1>
    <p>Your account does not have access to this workspace.</p>
    <a className="text-blue-600" href={result.current.user.role === "admin" ? "/admin" : "/dashboard"}>Go to your workspace</a>
  </main>;
  return <AuthenticatedWorkspace role={role} initial={result.current} />;
}
