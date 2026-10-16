import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { leadsForCompany, reasons, type LeadRow } from "@/lib/queries";
import { TIMINGS } from "@/lib/constants";
import { manRange, relative } from "@/lib/format";
import { Icon } from "@/components/icons";
import { LeadActions } from "@/components/lead-actions";
import { Badge, EmptyState, PageHeader, cx } from "@/components/ui";

export const metadata = { title: "案件一覧" };
export const dynamic = "force-dynamic";

const open = (l: LeadRow) => ["consulting", "quoting", "comparing"].includes(l.project_status);
const TABS = [
  { key: "new", label: "新着", filter: (l: LeadRow) => l.company_response === "none" && l.match_status === "candidate" && open(l) },
  { key: "pending", label: "対応希望済み", filter: (l: LeadRow) => l.company_response === "yes" && l.match_status === "candidate" && open(l) },
  { key: "matched", label: "マッチ済み", filter: (l: LeadRow) => l.match_status === "matched" },
  { key: "passed", label: "見送り・終了", filter: (l: LeadRow) => (l.company_response === "no" || !open(l)) && l.match_status !== "matched" },
] as const;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "new" } = await searchParams;
  const { membership } = await requireBusiness();
  const company = membership.company;
  const leads = company.status === "approved" ? leadsForCompany(company.id) : [];
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];
  const list = leads.filter(current.filter);
  return (
    <div>
      <PageHeader title="案件一覧" description="自社の対応エリア・カテゴリに合う相談だけが届きます。お客様の個人情報は、マッチ成立まで表示されません。" />
      <div className="no-scrollbar -mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => {
          const count = leads.filter(t.filter).length;
          return (
            <Link key={t.key} href={`/business/leads?tab=${t.key}`} className={cx("shrink-0 rounded-full px-4 py-2 text-sm font-medium", t.key === current.key ? "bg-ink text-white" : "bg-soft text-ink-2 hover:bg-line-2")}>
              {t.label}
              <span className={cx("ml-1.5 text-[12px]", t.key === current.key ? "text-white/60" : "text-faint")}>{count}</span>
            </Link>
          );
        })}
      </div>
      {list.length === 0 ? (
        <EmptyState icon="inbox" title={company.status === "approved" ? "該当する案件はありません" : "審査完了後に案件が表示されます"} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((l) => (
            <article key={l.match_id} className="flex flex-col rounded-3xl border border-line bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {l.customer_interest && l.match_status !== "matched" ? <Badge tone="dark">お客様が話したい</Badge> : l.match_status === "matched" ? <Badge tone="ok">マッチ済み</Badge> : <Badge tone="brand">新着</Badge>}
                  <span className="text-[12px] text-faint">{relative(l.created_at)}</span>
                </div>
                <span className="text-[13px] font-bold text-brand">マッチ度 {l.score}%</span>
              </div>
              <Link href={`/business/leads/${l.project_id}`} className="mt-4 block">
                <div className="text-[22px] font-bold tracking-tight">{l.city}</div>
                <div className="mt-1 text-[15px] font-semibold text-ink-2">
                  {l.house_type}
                  {l.building_age != null && `・築${l.building_age}年`}
                </div>
                <dl className="mt-4 grid grid-cols-[5rem_1fr] gap-y-1.5 text-[13px]">
                  <dt className="text-muted">工事内容</dt>
                  <dd className="font-medium">{l.category_name}{l.concerns && <span className="text-muted">（{l.concerns}）</span>}</dd>
                  <dt className="text-muted">希望時期</dt>
                  <dd>{TIMINGS.find((t) => t.value === l.desired_timing)?.label}</dd>
                  <dt className="text-muted">予算</dt>
                  <dd>{manRange(l.budget_min, l.budget_max)}</dd>
                  <dt className="text-muted">写真</dt>
                  <dd className="flex items-center gap-1"><Icon name="image" size={14} className="text-muted" />{l.photo_count}枚</dd>
                </dl>
                <div className="mt-3 flex flex-wrap gap-x-2.5 gap-y-1 text-[11.5px] text-muted">
                  {reasons(l).slice(1, 4).map((r) => <span key={r}>✓ {r}</span>)}
                </div>
              </Link>
              <div className="mt-auto pt-5">
                <LeadActions projectId={l.project_id} matchId={l.match_id} response={l.company_response} matched={l.match_status === "matched"} closed={!open(l)} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
