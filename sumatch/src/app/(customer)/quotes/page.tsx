import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { projectForCustomer } from "@/lib/access";
import { all, get } from "@/lib/db";
import { contractForProject, latestQuotesForProject, projectsForCustomer, workImage } from "@/lib/queries";
import { compareQuotes } from "@/lib/quote-compare";
import { ButtonLink, EmptyState, PageHeader, cx } from "@/components/ui";
import { Icon } from "@/components/icons";
import { dateJa } from "@/lib/format";
import type { Category, Match } from "@/lib/types";

export const metadata = { title: "見積を比べる" };
export const dynamic = "force-dynamic";

type View = "price" | "safe" | "days";

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ project?: string; view?: string }> }) {
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
  type Q = (typeof quotes)[number];
  const view: View = sp.view === "safe" || sp.view === "days" ? sp.view : "price";
  const views: { key: View; label: string; win: Q | null; value: (q: Q) => string }[] = [
    { key: "price", label: "価格で選ぶ", win: winner((q) => q.total === best.price), value: (q) => `¥${q.total.toLocaleString("ja-JP")}` },
    { key: "safe", label: "安心で選ぶ", win: winner((q) => q.warranty_years === best.warranty), value: (q) => `保証${q.warranty_years}年` },
    { key: "days", label: "工期で選ぶ", win: winner((q) => q.duration_days === best.days), value: (q) => `約${q.duration_days}日` },
  ];
  // Small tags: 最安 / 安心 (longest warranty) / 最短.
  const tags = (q: Q) =>
    multi ? ([q.total === best.price && "最安", q.warranty_years === best.warranty && "安心", q.duration_days === best.days && "最短"].filter(Boolean) as string[]) : [];
  const order: Record<View, (a: Q, b: Q) => number> = {
    price: (a, b) => a.total - b.total,
    safe: (a, b) => b.warranty_years - a.warranty_years || b.company.rating_avg - a.company.rating_avg,
    days: (a, b) => (a.duration_days ?? 999) - (b.duration_days ?? 999),
  };
  const sorted = [...quotes].sort(order[view]);
  const cover = (companyId: string) => workImage(get<{ image_url: string | null; file_id: string | null }>("SELECT image_url, file_id FROM company_works WHERE company_id = ? ORDER BY (category_id = ?) DESC, created_at LIMIT 1", companyId, project.category_id));
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
    <div className="mx-auto">
      <PageHeader back={{ href: `/projects/${project.id}`, label: "相談" }} eyebrow={`${category?.name ?? ""}・${project.city}`} title="見積を比べる" kicker="比べて、納得して決める" />

      {quotes.length === 0 ? (
        <EmptyState title="見積を待っています" action={<ButtonLink href="/messages" variant="secondary">メッセージを開く</ButtonLink>}>
          現地を確認したあと、会社から届きます。
        </EmptyState>
      ) : (
        <>
          {multi && (
            <nav className="mb-8 grid grid-cols-3 gap-2 sm:gap-3" aria-label="比べる視点">
              {views.map((v) => {
                const on = v.key === view;
                return (
                  <Link
                    key={v.key}
                    href={`/quotes?project=${project.id}&view=${v.key}`}
                    scroll={false}
                    aria-current={on ? "true" : undefined}
                    className={cx(
                      "lift min-w-0 rounded-[24px] border-2 p-3.5 sm:p-5",
                      on ? "border-brand bg-brand text-white shadow-[var(--shadow-lift)]" : "border-transparent bg-surface shadow-[var(--shadow-card)]",
                    )}
                  >
                    <div className={cx("text-[13px] font-semibold sm:text-[15px]", on ? "text-white" : "text-brand")}>{v.label}</div>
                    <div className={cx("mt-1.5 truncate text-[12px] sm:text-[14px]", on ? "text-white/80" : "text-muted")}>{v.win ? v.win.company.name : "差はありません"}</div>
                    {v.win && <div className={cx("tnum truncate text-[14px] font-semibold sm:text-[18px]", on ? "text-white" : "text-ink")}>{v.value(v.win)}</div>}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="no-scrollbar -mx-5 flex snap-x scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
            {sorted.map((q, i) => {
              const chosen = contract?.quote_id === q.id;
              const lead = multi && i === 0 && !contract;
              const photo = cover(q.company_id);
              const mine = cautions.filter((n) => n.companyId === q.company_id);
              return (
                <section
                  key={q.id}
                  aria-labelledby={`q-${q.id}`}
                  className={cx(
                    "w-[84vw] max-w-[360px] shrink-0 snap-start overflow-hidden rounded-[24px] border-2 bg-surface md:w-auto md:max-w-none",
                    chosen || lead ? "border-brand shadow-[var(--shadow-lift)]" : "border-transparent shadow-[var(--shadow-card)]",
                    contract && !chosen && "opacity-60",
                  )}
                >
                  <div className="relative h-24 bg-soft">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {photo && <img src={photo} alt="" className="size-full object-cover" />}
                    <div className="absolute left-4 top-3 flex flex-wrap gap-1.5">
                      {chosen && <span className="rounded-full bg-brand px-2.5 py-1 text-[12px] font-medium text-white">決定</span>}
                      {tags(q).map((t) => (
                        <span key={t} className="rounded-full bg-surface/95 px-2.5 py-1 text-[12px] font-semibold text-brand shadow-[var(--shadow-card)]">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="p-6 pt-5">
                  <h2 id={`q-${q.id}`} className="text-[17px] font-semibold">
                    {q.company.name}
                  </h2>
                  <div className={cx("tnum mt-2 text-[40px] font-semibold leading-none", view === "price" && lead && "text-brand")}>¥{q.total.toLocaleString("ja-JP")}</div>
                  <div className="mt-1.5 text-[13px] text-muted">税込</div>
                  <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4">
                    <div>
                      <dt className="text-[12px] text-muted">工期</dt>
                      <dd className={cx("tnum mt-0.5 text-[19px] font-semibold", view === "days" && lead && "text-brand")}>{q.duration_days ? `${q.duration_days}日` : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[12px] text-muted">保証</dt>
                      <dd className={cx("tnum mt-0.5 text-[19px] font-semibold", view === "safe" && lead && "text-brand")}>{q.warranty_years ? `${q.warranty_years}年` : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[12px] text-muted">評価</dt>
                      <dd className="tnum mt-0.5 text-[19px] font-semibold">★{q.company.rating_avg.toFixed(1)}</dd>
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
                  <Link
                    href={`/quotes/${q.id}`}
                    className={cx(
                      "press mt-5 flex h-12 items-center justify-center rounded-xl text-[15px] font-medium",
                      lead ? "bg-brand text-white hover:bg-brand-2" : "border border-line hover:border-ink/20",
                    )}
                  >
                    見積を見る
                  </Link>
                  </div>
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
