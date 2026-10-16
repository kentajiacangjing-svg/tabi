import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireUser(["admin"], "/admin");
  return (
    <AppShell mode="admin" wide>
      {children}
    </AppShell>
  );
}
