import { AppShell } from "@/components/app-shell";
import { requireBusiness } from "@/lib/auth";
import { Notice } from "@/components/ui";

export default async function BusinessAppLayout({ children }: { children: React.ReactNode }) {
  const { membership } = await requireBusiness();
  const status = membership.company.status;
  return (
    <AppShell mode="business" wide>
      {status === "pending" && (
        <Notice tone="warn" icon="clock" className="mb-6">
          現在、運営が登録内容を確認しています。審査が完了すると案件が届くようになります。その間にプロフィールと施工事例を充実させておきましょう。
        </Notice>
      )}
      {status === "rejected" && <Notice tone="danger" className="mb-6">登録をお見送りしました。詳細は運営からのご連絡をご確認ください。</Notice>}
      {children}
    </AppShell>
  );
}
