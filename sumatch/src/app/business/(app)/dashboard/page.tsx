import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { get } from "@/lib/db";
import { leadsForCompany } from "@/lib/queries";
import { matchLimitFor, monthlyMatchUsage } from "@/lib/services";
import { dateJa } from "@/lib/format";
import { ButtonLink, Stat } from "@/components/ui";
import type { Plan } from "@/lib/types";

export const metadata = { title: "ホーム" };
export const dynamic = "force-dynamic";

export default async function BusinessDashboard() {
  const { user, membership } = await requireBusiness();
  const c = membership.company;
  const open = (s: string) => ["consulting", "quoting", "comparing"].includes(s);
  const leads = c.status === "approved" ? leadsForCompany(c.id) : [];
  const fresh = leads.filter((l) => l.company_response === "none" && l.match_status === "candidate" && open(l.project_status));
  const wanted = fresh.filter((l) => l.customer_interest).length;
  const n = (sql: string) => get<{ n: number }>(sql, c.id)?.n ?? 0;
  const active = n("SELECT COUNT(*) n FROM matches m JOIN projects p ON p.id = m.project_id WHERE m.company_id = ? AND m.status = 'matched' AND p.status IN ('consulting','quoting','comparing')");
  const quoted = n(
    "SELECT COUNT(DISTINCT q.match_id) n FROM quotes q JOIN projects p ON p.id = q.project_id WHERE q.company_id = ? AND q.status = 'submitted' AND p.status IN ('consulting','quoting','comparing')",
  );
  const contracts = n("SELECT COUNT(*) n FROM contracts WHERE company_id = ? AND status IN ('contracted','in_progress')");
  const usage = monthlyMatchUsage(c.id);
  const limit = matchLimitFor(c);
  const plan = c.plan_id ? get<Plan>("SELECT * FROM plans WHERE id = ?", c.plan_id) : undefined;
  const trial = c.trial_ends_at && c.trial_ends_at >= new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-[960px]">
      <p className="text-[15px] text-muted">{c.name}</p>
      <h1 className="mt-1 text-[30px] font-semibold sm:text-[36px]">こんにちは、{user.name.split(" ")[0]}さん</h1>

      {c.status === "approved" && fresh.length > 0 && (
        <div className="mt-8 flex flex-col gap-4 border-y border-line py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[18px]">
            新しい相談が{fresh.length}件あります。
            {wanted > 0 && <span className="text-brand">うち{wanted}件はお客様から相談の希望が届いています。</span>}
          </p>
          <ButtonLink href="/business/leads" size="lg">
            相談を見る
          </ButtonLink>
        </div>
      )}

      <div className="mt-12 grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
        <Link href="/business/leads" className="hover:opacity-80">
          <Stat label="新しい相談" value={fresh.length} tone={fresh.length ? "brand" : undefined} />
        </Link>
        <Link href="/business/active" className="hover:opacity-80">
          <Stat label="進行中" value={active} />
        </Link>
        <Link href="/business/quotes" className="hover:opacity-80">
          <Stat label="見積もり提出済み" value={quoted} />
        </Link>
        <Link href="/business/active" className="hover:opacity-80">
          <Stat label="契約" value={contracts} />
        </Link>
      </div>

      <div className="mt-16 grid gap-6 border-t border-line pt-8 text-[15px] sm:grid-cols-3">
        <div>
          <div className="text-muted">今月のマッチ</div>
          <div className="mt-1">
            {usage} / {limit}件
          </div>
        </div>
        <div>
          <div className="text-muted">プラン</div>
          <div className="mt-1">
            {plan?.name ?? "未設定"}
            {trial && <span className="text-muted">（{dateJa(c.trial_ends_at)}まで無料）</span>}
          </div>
        </div>
        <div>
          <div className="text-muted">評価</div>
          <div className="mt-1">
            ★ {c.rating_avg.toFixed(1)}
            <span className="text-muted">（口コミ{c.review_count}件）</span>
          </div>
        </div>
      </div>
    </div>
  );
}
