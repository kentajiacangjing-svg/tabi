import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { get } from "@/lib/db";
import { leadsForCompany } from "@/lib/queries";
import { matchLimitFor, monthlyMatchUsage } from "@/lib/services";
import { BUDGETS, TIMINGS } from "@/lib/constants";
import { manRange, relative } from "@/lib/format";
import { fileUrl } from "@/lib/urls";
import { LeadDeck } from "@/components/lead-deck";
import { cx } from "@/components/ui";

export const metadata = { title: "ホーム" };
export const dynamic = "force-dynamic";

export default async function BusinessHome() {
  const { user, membership } = await requireBusiness();
  const c = membership.company;
  const open = (s: string) => ["consulting", "quoting", "comparing"].includes(s);
  const fresh = c.status === "approved" ? leadsForCompany(c.id).filter((l) => l.company_response === "none" && l.match_status === "candidate" && open(l.project_status)) : [];
  const n = (sql: string) => get<{ n: number }>(sql, c.id)?.n ?? 0;
  // 返信待ち: conversations where the customer spoke last.
  const awaitingReply = n(
    `SELECT COUNT(*) n FROM matches m WHERE m.company_id = ? AND m.status = 'matched'
       AND (SELECT sender_side FROM messages g WHERE g.match_id = m.id AND g.sender_side != 'system' ORDER BY created_at DESC LIMIT 1) = 'customer'`,
  );
  const toQuote = n(
    `SELECT COUNT(*) n FROM matches m JOIN projects p ON p.id = m.project_id
      WHERE m.company_id = ? AND m.status = 'matched' AND p.status IN ('consulting','quoting','comparing') AND NOT EXISTS (SELECT 1 FROM quotes q WHERE q.match_id = m.id)`,
  );
  const contracts = n("SELECT COUNT(*) n FROM contracts WHERE company_id = ? AND status IN ('contracted','in_progress')");
  const limit = matchLimitFor(c);
  const blocked = monthlyMatchUsage(c.id) >= limit ? `今月のマッチ上限（${limit}件）に達しています。` : undefined;

  const todo = [
    { label: "新しい相談", value: fresh.length, href: "/business/leads", strong: fresh.length > 0 },
    { label: "返信待ち", value: awaitingReply, href: "/business/messages", strong: awaitingReply > 0 },
    { label: "見積作成", value: toQuote, href: "/business/quotes", strong: toQuote > 0 },
    { label: "契約", value: contracts, href: "/business/active", strong: false },
  ];

  const leads = fresh.map((l) => {
    const photo = get<{ file_id: string }>("SELECT file_id FROM project_images WHERE project_id = ? ORDER BY sort LIMIT 1", l.project_id);
    const project = get<{ details: string }>("SELECT details FROM projects WHERE id = ?", l.project_id);
    return {
      projectId: l.project_id,
      city: l.city,
      category: l.category_name,
      houseType: l.house_type,
      budget: BUDGETS.find((b) => b.min === l.budget_min && b.max === l.budget_max)?.label ?? manRange(l.budget_min, l.budget_max),
      timing: TIMINGS.find((t) => t.value === l.desired_timing)?.label ?? "—",
      photos: l.photo_count,
      photo: fileUrl(photo?.file_id),
      details: (project?.details ?? "").slice(0, 80),
      customerWants: !!l.customer_interest,
      received: relative(l.created_at),
    };
  });

  return (
    <div className="mx-auto max-w-[960px]">
      <p className="text-[14px] text-muted">{c.name}</p>
      <h1 className="mt-1 text-[30px] font-semibold sm:text-[36px]">今日やること</h1>
      <p className="mt-1 text-[15px] text-muted">{user.name.split(" ")[0]}さん、おつかれさまです。</p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {todo.map((t) => (
          <Link key={t.label} href={t.href} className="press rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] hover:border-ink/25">
            <div className={cx("text-[40px] font-medium leading-none tracking-tight", t.strong ? "text-brand" : "text-ink")}>{t.value}</div>
            <div className="mt-2 text-[15px]">{t.label}</div>
          </Link>
        ))}
      </div>

      <section className="mt-14">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[20px] font-semibold">新着の相談</h2>
          <Link href="/business/analytics" className="text-[14px] text-muted hover:text-ink">
            分析を見る
          </Link>
        </div>
        {c.status !== "approved" ? (
          <p className="rounded-2xl border border-line bg-surface p-6 text-[15px] text-muted">審査が終わると、ここに相談が届きます。</p>
        ) : (
          <LeadDeck leads={leads} blockedReason={blocked} />
        )}
      </section>
    </div>
  );
}
