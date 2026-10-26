"use client";

import dynamic from "next/dynamic";
import type { CurrentUser } from "@gethired/contracts";
import SessionProvider from "./SessionProvider";

const Dashboard = dynamic(() => import("./Dashboard"));
const AdminDashboard = dynamic(() => import("./AdminDashboard"));

export default function AuthenticatedWorkspace({
  role,
  initial,
}: {
  role: "student" | "admin";
  initial: CurrentUser;
}) {
  if (initial.user.role !== role)
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p>Your account does not have access to this workspace.</p>
        <a
          className="text-blue-600"
          href={initial.user.role === "admin" ? "/admin" : "/dashboard"}
        >
          Go to your workspace
        </a>
      </main>
    );
  return (
    <SessionProvider key={`${initial.user.id}:${initial.user.role}`} initial={initial}>
      {role === "admin" ? <AdminDashboard /> : <Dashboard />}
    </SessionProvider>
  );
}
