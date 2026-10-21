import { mailIsDelivered } from "@/lib/mailer";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { AccountForm, DeletionRequestForm, PasswordForm } from "@/components/account-forms";
import { get } from "@/lib/db";
import { Button, PageHeader } from "@/components/ui";

export const metadata = { title: "アカウント" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser(["customer"], "/account");
  return (
    <div className="mx-auto max-w-[640px]">
      <PageHeader title="アカウント" description={user.email} />
      <div className="space-y-14">
        <section>
          <h2 className="mb-5 text-[20px] font-medium">お名前と通知</h2>
          <AccountForm name={user.name} notifyEmail={!!user.notify_email} notifyBrowser={!!user.notify_browser} mailActive={mailIsDelivered()} />
        </section>
        <section className="border-t border-line pt-10">
          <h2 className="mb-5 text-[20px] font-medium">パスワード</h2>
          <PasswordForm />
        </section>
        <section className="border-t border-line pt-10">
          <h2 className="text-[20px] font-medium">会社に伝わる情報</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            お名前、市区町村、相談の内容、写真だけです。メールアドレスや電話番号が会社に伝わることはありません。
          </p>
        </section>
        <section className="border-t border-line pt-10">
          <h2 className="mb-5 text-[20px] font-medium">退会</h2>
          <DeletionRequestForm pending={!!get("SELECT 1 FROM account_deletion_requests WHERE user_id = ? AND status = 'requested'", user.id)} />
        </section>
        <form action={logoutAction} className="border-t border-line pt-10">
          <Button variant="secondary" size="lg" className="w-full">
            ログアウト
          </Button>
        </form>
      </div>
    </div>
  );
}
