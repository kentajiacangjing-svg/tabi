import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { projectForCustomer } from "@/lib/access";
import { all, get } from "@/lib/db";
import { contractForProject, latestQuotesForProject, projectsForCustomer } from "@/lib/queries";
import { compareQuotes } from "@/lib/quote-compare";
import { ButtonLink, EmptyState, PageHeader, cx } from "@/components/ui";
import { Icon } from "@/components/icons";
import { dateJa } from "@/lib/format";
import type { Category, Match } from "@/lib/types";

export const metadata = { title: "見積を比べる" };
export const dynamic = "force-dynamic";

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser(["customer"], "/quotes");
  if (!sp.project) {
    const ps = projectsForCustomer(user.id);
    const target = ps.find((p) => p.quote_count > 0) ?? ps[0];
    if (target) redirect(`/quotes?project=${target.id}`);
    return (
      <EmptyState title="まだ見積はありません" action={<ButtonLink href="/">相談を始める</ButtonLink>}>
        マッチした会社から見積が届くと、ここで比べられます。
      </EmptyState>
    );
  }
  const project = projectForCustomer(sp.project, user);
  if (!project) redirect("/projects");
  const category = get<Category>("SELECT name FROM categories WHERE id = ?", project.category_id);
  const quotes = latestQuotesForProject(project.id);
  const contract = contractForProject(project.id);
  const waiting = all<Match & { name: string }>(
    "SELECT m.*, c.name FROM matches m JOIN companies c ON c.id = m.company_id WHERE m.project_id = ? AND m.status = 'matched' AND NOT EXISTS (SELECT 1 FROM quotes q WHERE q.match_id = m.id)",
    project.id,
  );
  const staff = (id: string | null) => (id ? get<{ name: string }>("SELECT name FROM users WHERE id = ?", id)?.name : undefined);

  // What makes each estimate stand out: 価格 / 安心 / 工期. Only shown when there is something to compare.
  const multi = quotes.length > 1;
  const best = {
    price: Math.min(...quotes.map((q) => q.total)),
    warranty: Math.max(...quotes.map((q) => q.warranty_years)),
    days: Math.min(...quotes.map((q) => q.duration_days ?? Infinity)),
  };
  const winner = (pick: (q: (typeof quotes)[number]) => boolean) => {
    const w = quotes.filter(pick);
    return w.length === 1 ? w[0] : null;
  };
  const summary = multi
    ? ([
        ["価格", winner((q) => q.total === best.price), (q: (typeof quotes)[number]) => `¥${q.total.toLocaleString("ja-JP")}`],
        ["安心", winner((q) => q.warranty_years === best.warranty), (q: (typeof quotes)[number]) => `保証${q.warranty_years}年`],
        ["工期", winner((q) => q.duration_days === best.days), (q: (typeof quotes)[number]) => `約${q.duration_days}日`],
      ] as const)
    : [];
  const tags = (q: (typeof quotes)[number]) =>
    multi
      ? [q.total === best.price && "いちばん安い", q.warranty_years === best.warranty && "保証がいちばん長い", q.duration_days === best.days && "工期がいちばん短い"].filter(Boolean)
      : [];
  const cautions = compareQuotes(
    quotes.map((q) => ({
      companyId: q.company_id,
      companyName: q.company.name,
      total: q.total,
      warrantyYears: q.warranty_years,
      durationDays: q.duration_days,
      extraCosts: q.extra_costs,
      itemCount: q.items.length,
      materials: q.materials,
    })),
  ).filter((n) => n.tone === "caution");

  return (
    <div className="mx-auto max-w-[1080px]">
      <PageHeader back={{ href: `/projects/${project.id}`, label: "相談" }} eyebrow={`${category?.name ?? ""}・${project.city}`} title="見積を比べる" />

      {quotes.length === 0 ? (
        <EmptyState title="見積を待っています" action={<ButtonLink href="/messages" variant="secondary">メッセージを開く</ButtonLink>}>
          現地を確認したあと、会社から届きます。
        </EmptyState>
      ) : (
        <>
          {summary.length > 0 && (
            <div className="mb-8 divide-y divide-brand/10 rounded-2xl bg-brand-soft px-5 md:grid md:grid-cols-3 md:divide-x md:divide-y-0 md:px-0">
              {summary.map(([label, q, fmt]) => (
                <div key={label} className="flex items-baseline justify-between gap-3 py-3.5 md:block md:px-5 md:py-4">
                  <div className="shrink-0 text-[13px] text-brand">{label}で選ぶなら</div>
                  <div className="min-w-0 text-right md:mt-1 md:text-left">
                    <div className="truncate text-[16px] font-medium">{q ? q.company.name : "差はありません"}</div>
                    {q && <div className="text-[13px] text-ink-2">{fmt(q)}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="no-scrollbar -mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
            {quotes.map((q) => {
              const chosen = contract?.quote_id === q.id;
              const mine = cautions.filter((n) => n.companyId === q.company_id);
              return (
                <section
                  key={q.id}
                  aria-labelledby={`q-${q.id}`}
                  className={cx("w-[84vw] max-w-[360px] shrink-0 snap-start rounded-3xl border bg-surface p-6 shadow-[var(--shadow-card)] md:w-auto md:max-w-none", chosen ? "border-brand" : "border-line", contract && !chosen && "opacity-60")}
                >
                  <div className="flex min-h-6 flex-wrap gap-1.5">
                    {chosen && <span className="rounded-lg bg-brand px-2 py-0.5 text-[12px] text-white">決定</span>}
                    {tags(q).map((t) => (
                      <span key={t as string} className="rounded-lg bg-brand-soft px-2 py-0.5 text-[12px] text-brand">
                        {t}
                      </span>
                    ))}
                  </div>
                  <h2 id={`q-${q.id}`} className="mt-3 text-[18px] font-medium">
                    {q.company.name}
                  </h2>
                  <div className="mt-2 text-[34px] font-medium leading-none tracking-tight">¥{q.total.toLocaleString("ja-JP")}</div>
                  <div className="mt-1 text-[13px] text-muted">税込</div>
                  <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4">
                    <div>
                      <dt className="text-[12px] text-muted">工期</dt>
                      <dd className="mt-0.5 text-[17px]">{q.duration_days ? `${q.duration_days}日` : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[12px] text-muted">保証</dt>
                      <dd className="mt-0.5 text-[17px]">{q.warranty_years ? `${q.warranty_years}年` : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[12px] text-muted">評価</dt>
                      <dd className="mt-0.5 text-[17px]">★{q.company.rating_avg.toFixed(1)}</dd>
                    </div>
                  </dl>
                  <details className="group mt-4 border-t border-line">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-[15px] text-ink-2">
                      詳細
                      <Icon name="chevron-down" size={16} className="transition-transform group-open:rotate-180" />
                    </summary>
                    <dl className="space-y-2.5 pb-2 text-[14px]">
                      <Detail label="材料" value={q.materials} />
                      <Detail label="追加費用" value={q.extra_costs || "記載なし"} />
                      <Detail label="支払い" value={q.payment_terms} />
                      <Detail label="担当者" value={staff(q.created_by)} />
                      <Detail label="有効期限" value={dateJa(q.valid_until)} />
                    </dl>
                  </details>
                  {mine.map((n, i) => (
                    <p key={i} className="mt-2 text-[13px] leading-relaxed text-warn">
                      {n.text}
                    </p>
                  ))}
                  <Link href={`/quotes/${q.id}`} className="press mt-5 flex h-12 items-center justify-center rounded-xl border border-line text-[15px] font-medium hover:border-ink/25">
                    見積を見る
                  </Link>
                </section>
              );
            })}
          </div>
        </>
      )}

      {waiting.length > 0 && !contract && <p className="mt-10 text-[14px] text-muted">{waiting.map((w) => w.name).join("、")}の見積を待っています。</p>}
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0">{value || "—"}</dd>
    </div>
  );
}
