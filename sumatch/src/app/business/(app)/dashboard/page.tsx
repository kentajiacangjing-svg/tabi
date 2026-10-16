import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { get } from "@/lib/db";
import { conversationsForCompany, leadsForCompany } from "@/lib/queries";
import { matchLimitFor, monthlyMatchUsage } from "@/lib/services";
import { dateJa, man, pct, relative } from "@/lib/format";
import { UserAvatar } from "@/components/brand";
import { Icon } from "@/components/icons";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Stars, Stat } from "@/components/ui";
import type { Plan } from "@/lib/types";

export const metadata = { title: "ダッシュボード" };
export const dynamic = "force-dynamic";

export default async function BusinessDashboard() {
  const { user, membership } = await requireBusiness();
  const c = membership.company;
  const leads = leadsForCompany(c.id);
  const openLead = (l: (typeof leads)[number]) => ["consulting", "quoting", "comparing"].includes(l.project_status);
  const newLeads = leads.filter((l) => l.company_response === "none" && l.match_status === "candidate" && openLead(l));
  const wanted = newLeads.filter((l) => l.customer_interest);
  const convs = conversationsForCompany(c.id);
  const unread = convs.reduce((a, b) => a + b.unread, 0);
  const n = (sql: string, ...p: string[]) => get<{ n: number }>(sql, ...p)?.n ?? 0;
  const matchedTotal = n("SELECT COUNT(*) n FROM matches WHERE company_id = ? AND matched_at IS NOT NULL", c.id);
  const quoted = n("SELECT COUNT(DISTINCT match_id) n FROM quotes WHERE company_id = ?", c.id);
  const contracted = n("SELECT COUNT(*) n FROM contracts WHERE company_id = ? AND status = 'contracted'", c.id);
  const inProgress = n("SELECT COUNT(*) n FROM contracts WHERE company_id = ? AND status = 'in_progress'", c.id);
  const completed = n("SELECT COUNT(*) n FROM contracts WHERE company_id = ? AND status = 'completed'", c.id);
  const wonTotal = contracted + inProgress + completed;
  const decided = n(
    "SELECT COUNT(*) n FROM matches m JOIN contracts ct ON ct.project_id = m.project_id WHERE m.company_id = ? AND m.matched_at IS NOT NULL",
    c.id,
  );
  const wonAmount = get<{ s: number | null }>("SELECT SUM(amount) s FROM contracts WHERE company_id = ?", c.id)?.s ?? 0;
  const usage = monthlyMatchUsage(c.id);
  const limit = matchLimitFor(c);
  const plan = c.plan_id ? get<Plan>("SELECT * FROM plans WHERE id = ?", c.plan_id) : undefined;
  const trial = c.trial_ends_at && c.trial_ends_at >= new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader
        eyebrow={c.name}
        title={`おつかれさまです、${user.name.split(" ")[0]}さん`}
        description={newLeads.length ? `新しい案件が${newLeads.length}件あります。` : "新しい案件が届くと通知でお知らせします。"}
      />

      {wanted.length > 0 && (
        <Link href="/business/leads" className="mb-6 flex items-center gap-3 rounded-3xl bg-ink px-5 py-4 text-white">
          <span className="grid size-10 place-items-center rounded-full bg-white/10"><Icon name="users" size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">お客様から「話したい」が{wanted.length}件届いています</span>
            <span className="block text-[13px] text-white/70">「対応したい」を押すとすぐにチャットが始まります。</span>
          </span>
          <Icon name="chevron-right" size={20} />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="新着案件" value={newLeads.length} sub={`うち希望あり ${wanted.length}件`} tone="brand" />
        <Stat label="今月のマッチ" value={`${usage} / ${limit}`} sub={plan ? `${plan.name}プラン${trial ? "・無料期間中" : ""}` : "プラン未設定"} />
        <Stat label="未読メッセージ" value={unread} sub={`チャット中 ${convs.length}件`} />
        <Stat label="評価" value={<span className="flex items-center gap-2">{c.rating_avg.toFixed(1)}<Stars value={c.rating_avg} size={13} /></span>} sub={`口コミ ${c.review_count}件`} />
      </div>

      <Card className="mt-6 p-5 sm:p-6">
        <SectionTitle>案件の流れ</SectionTitle>
        <div className="grid grid-cols-3 gap-y-5 sm:grid-cols-6">
          {[
            ["マッチ済み", matchedTotal],
            ["見積もり提出", quoted],
            ["契約", contracted],
            ["施工中", inProgress],
            ["完了", completed],
            ["成約率", decided ? pct(wonTotal / decided) : "—"],
          ].map(([label, value], i) => (
            <div key={label as string} className="relative px-2 text-center">
              {i > 0 && <span className="absolute left-0 top-3 hidden h-6 w-px bg-line sm:block" />}
              <div className="text-[24px] font-bold tracking-tight">{value}</div>
              <div className="mt-0.5 text-[12px] text-muted">{label}</div>
            </div>
          ))}
        </div>
        <p className="mt-5 border-t border-line pt-4 text-[12px] text-muted">
          成約金額の累計 {man(wonAmount)}・成約率は「お客様が依頼先を決めた案件」のうち自社が選ばれた割合です。
        </p>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <SectionTitle action={<Link href="/business/leads" className="text-[13px] font-semibold text-brand">すべて見る</Link>}>新着案件</SectionTitle>
          {newLeads.length === 0 ? (
            <EmptyState icon="inbox" title="新着案件はありません">対応エリア・カテゴリを増やすと、届く案件が増えます。</EmptyState>
          ) : (
            <ul className="divide-y divide-line-2">
              {newLeads.slice(0, 5).map((l) => (
                <li key={l.match_id}>
                  <Link href={`/business/leads/${l.project_id}`} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{l.city}・{l.category_name}</span>
                        {l.customer_interest ? <Badge tone="dark">話したい</Badge> : <Badge tone="brand">新着</Badge>}
                      </div>
                      <div className="truncate text-[12px] text-muted">{l.house_type}{l.building_age != null && `・築${l.building_age}年`}・{relative(l.created_at)}</div>
                    </div>
                    <span className="text-[13px] font-bold text-brand">{l.score}%</span>
                    <Icon name="chevron-right" size={16} className="text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5 sm:p-6">
          <SectionTitle action={<Link href="/business/messages" className="text-[13px] font-semibold text-brand">すべて見る</Link>}>最近のチャット</SectionTitle>
          {convs.length === 0 ? (
            <EmptyState icon="chat" title="まだチャットはありません" />
          ) : (
            <ul className="divide-y divide-line-2">
              {convs.slice(0, 5).map((cv) => (
                <li key={cv.match_id}>
                  <Link href={`/business/messages/${cv.match_id}`} className="flex items-center gap-3 py-3">
                    <UserAvatar name={cv.customer_name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{cv.customer_name}様<span className="ml-2 font-normal text-muted">{cv.project_city}</span></div>
                      <div className="truncate text-[12px] text-muted">{cv.last_kind === "quote" ? "見積書" : cv.last_message}</div>
                    </div>
                    {cv.unread > 0 && <span className="rounded-full bg-brand px-2 text-[11px] font-bold leading-5 text-white">{cv.unread}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {c.trial_ends_at && trial && <p className="mt-6 text-center text-[12px] text-faint">無料期間: {dateJa(c.trial_ends_at)}まで</p>}
    </div>
  );
}
