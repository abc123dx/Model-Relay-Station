import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth";
import { ensureHealthScheduler } from "@/lib/health";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  ensureHealthScheduler();
  return <AdminShell>{children}</AdminShell>;
}
