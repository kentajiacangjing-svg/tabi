import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { all } from "@/lib/db";
import { activeAreas, activeCategories, companyProfile, workImage } from "@/lib/queries";
import { CompanyForm } from "@/components/company-form";
import { MembersEditor, PlanPicker, WebInterestButton, WorksEditor } from "@/components/business-settings";
import { AccountForm, PasswordForm } from "@/components/account-forms";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { Icon } from "@/components/icons";
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
    <div className="max-w-3xl">
      <PageHeader
        title="会社情報・設定"
        description="ここで登録した内容が、お客様に表示される企業プロフィールになります。"
        action={c.status === "approved" ? <Link href={`/company/${c.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand">公開ページを見る<Icon name="external" size={14} /></Link> : undefined}
      />
      <div className="space-y-8">
        <CompanyForm
          mode="edit"
          initial={{ ...c, category_works: Object.fromEntries(p.categories.map((x) => [x.id, x.works_count])), area_ids: p.areas.map((a) => a.id) }}
          categories={cats.map((x) => ({ id: x.id, name: x.name }))}
          areas={activeAreas().map((a) => ({ id: a.id, name: a.city, sub: a.prefecture }))}
        />
        <Card className="p-5 sm:p-6">
          <SectionTitle>施工事例</SectionTitle>
          <WorksEditor works={p.works.map((w) => ({ id: w.id, title: w.title, city: w.city, cost_label: w.cost_label, image: workImage(w) }))} categories={cats.map((x) => ({ id: x.id, name: x.name }))} />
        </Card>
        <Card className="p-5 sm:p-6">
          <SectionTitle>担当者</SectionTitle>
          <MembersEditor members={members} isOwner={isOwner} meId={user.id} />
        </Card>
        <Card className="p-5 sm:p-6">
          <SectionTitle>料金プラン</SectionTitle>
          <PlanPicker plans={plans.map((x) => ({ id: x.id, name: x.name, price: x.monthly_price, limit: x.match_limit }))} currentId={c.plan_id} isOwner={isOwner} />
          <p className="mt-3 text-[12px] text-muted">プランは掲載順位に影響しません。お支払い方法の設定は運営からご案内します。</p>
        </Card>
        <Card className="p-5 sm:p-6">
          <SectionTitle>通知設定（{user.name}）</SectionTitle>
          <p className="mb-4 text-[13px] text-muted">新しい案件・メッセージはメールとブラウザ通知でお知らせします。LINE公式アカウント・LINE WORKSでの通知にも今後対応予定です（会話はSUMATCH内で行います）。</p>
          <AccountForm name={user.name} notifyEmail={!!user.notify_email} notifyBrowser={!!user.notify_browser} />
        </Card>
        <Card className="p-5 sm:p-6">
          <SectionTitle>パスワード</SectionTitle>
          <PasswordForm />
        </Card>
        <div className="rounded-3xl bg-soft p-5 sm:p-6">
          <div className="font-bold">{c.website_url ? "自社サイトをもっと活かしませんか？" : "自社サイトがなくても大丈夫です"}</div>
          <p className="mb-4 mt-1 text-[13px] leading-relaxed text-muted">
            SUMATCH上の企業ページは自動で公開されます。施工事例が映える自社サイトを作りたい場合は「SUMATCH Web」をご相談ください（ご利用有無はマッチング順位に影響しません）。
          </p>
          <WebInterestButton done={!!c.web_interest} />
        </div>
      </div>
    </div>
  );
}
