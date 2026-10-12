import AdminDashboard from "@/components/AdminDashboard";
import ProtectedPage from "@/components/ProtectedPage";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return <ProtectedPage role="admin"><AdminDashboard /></ProtectedPage>;
}
