import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { AccountForm, PasswordForm } from "@/components/account-forms";
import { Button, Card, PageHeader, SectionTitle } from "@/components/ui";

export const metadata = { title: "アカウント" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser(["customer"], "/account");
  return (
    <div className="max-w-xl">
      <PageHeader title="アカウント" description={user.email} />
      <div className="space-y-6">
        <Card className="p-5 sm:p-6">
          <SectionTitle>プロフィールと通知</SectionTitle>
          <AccountForm name={user.name} notifyEmail={!!user.notify_email} notifyBrowser={!!user.notify_browser} />
        </Card>
        <Card className="p-5 sm:p-6">
          <SectionTitle>パスワード</SectionTitle>
          <PasswordForm />
        </Card>
        <Card className="p-5 text-[13px] leading-relaxed text-muted sm:p-6">
          <SectionTitle>プライバシー</SectionTitle>
          会社に表示されるのは、お名前・市区町村・相談内容・写真のみです。メールアドレスや電話番号が会社に公開されることはありません。
        </Card>
        <form action={logoutAction}>
          <Button variant="secondary" className="w-full">ログアウト</Button>
        </form>
      </div>
    </div>
  );
}
