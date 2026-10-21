import { mailIsDelivered } from "@/lib/mailer";
import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { activeAreas, activeCategories, companyProfile, workImage } from "@/lib/queries";
import { CompanyForm } from "@/components/company-form";
import { MembersEditor, PlanPicker, WebInterestButton, WorksEditor } from "@/components/business-settings";
import { AccountForm, DeletionRequestForm, PasswordForm } from "@/components/account-forms";
import { PageHeader, SectionTitle } from "@/components/ui";
import type { Plan } from "@/lib/types";

export const metadata = { title: "会社情報・設定" };
export const dynamic = "force-dynamic";

export default async function BusinessProfilePage() {
  const { user, membership } = await requireBusiness();
  const p = companyProfile(membership.company.id)!;
  const c = p.company;
  const isOwner = membership.member_role === "owner";
  const members = all<{ id: string; name: string; email: string; role: string }>(
    "SELECT u.id, u.name, u.email, m.member_role AS role FROM company_members m JOIN users u ON u.id = m.user_id WHERE m.company_id = ? ORDER BY m.member_role DESC, m.created_at",
    c.id,
  );
  const plans = all<Plan>("SELECT * FROM plans WHERE active = 1 ORDER BY sort");
  const cats = activeCategories();
  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader
        title="会社"
        description="ここに登録した内容が、お客様が見る会社のページになります。"
        action={c.status === "approved" ? <Link href={`/company/${c.id}`} className="inline-flex min-h-11 items-center text-[15px] text-ink underline underline-offset-4">お客様から見たページ</Link> : undefined}
      />
      <div className="space-y-16">
        <CompanyForm
          mode="edit"
          initial={{ ...c, category_works: Object.fromEntries(p.categories.map((x) => [x.id, x.works_count])), area_ids: p.areas.map((a) => a.id) }}
          categories={cats.map((x) => ({ id: x.id, name: x.name }))}
          areas={activeAreas().map((a) => ({ id: a.id, name: a.city, sub: a.prefecture }))}
        />
        <section className="border-t border-line pt-10">
          <SectionTitle>施工事例</SectionTitle>
          <WorksEditor works={p.works.map((w) => ({ id: w.id, title: w.title, city: w.city, cost_label: w.cost_label, image: workImage(w) }))} categories={cats.map((x) => ({ id: x.id, name: x.name }))} />
        </section>
        <section className="border-t border-line pt-10">
          <SectionTitle>担当者</SectionTitle>
          <MembersEditor members={members} isOwner={isOwner} meId={user.id} />
        </section>
        <section className="border-t border-line pt-10">
          <SectionTitle>料金プラン</SectionTitle>
          <PlanPicker plans={plans.map((x) => ({ id: x.id, name: x.name, price: x.monthly_price, limit: x.match_limit }))} currentId={c.plan_id} isOwner={isOwner} />
          <p className="mt-4 text-[14px] text-muted">プランは紹介の順番に影響しません。お支払い方法は運営からご案内します。</p>
        </section>
        <section className="border-t border-line pt-10">
          <SectionTitle>通知設定（{user.name}）</SectionTitle>
          <p className="mb-6 text-[15px] text-muted">新しい相談とメッセージは、アプリ内のお知らせとブラウザ通知でお知らせします。メール・LINEでの通知は準備中です（会話はSUMATCHの中で行います）。</p>
          <AccountForm name={user.name} notifyEmail={!!user.notify_email} notifyBrowser={!!user.notify_browser} mailActive={mailIsDelivered()} />
        </section>
        <section className="border-t border-line pt-10">
          <SectionTitle>パスワード</SectionTitle>
          <PasswordForm />
        </section>
        <section className="border-t border-line pt-10">
          <SectionTitle>退会</SectionTitle>
          <DeletionRequestForm pending={!!get("SELECT 1 FROM account_deletion_requests WHERE user_id = ? AND status = 'requested'", user.id)} />
        </section>
        <section className="border-t border-line pt-10">
          <div className="text-[20px] font-semibold">{c.website_url ? "自社サイトをもっと活かしませんか？" : "自社サイトがなくても大丈夫です"}</div>
          <p className="mb-5 mt-2 text-[15px] leading-relaxed text-muted">
            SUMATCH上の企業ページは自動で公開されます。施工事例が映える自社サイトを作りたい場合は「SUMATCH Web」をご相談ください（ご利用有無はマッチング順位に影響しません）。
          </p>
          <WebInterestButton done={!!c.web_interest} />
        </section>
      </div>
    </div>
  );
}
