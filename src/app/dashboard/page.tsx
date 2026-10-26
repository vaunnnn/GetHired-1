import ProtectedPage from "@/components/ProtectedPage";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return <ProtectedPage role="student" />;
}
