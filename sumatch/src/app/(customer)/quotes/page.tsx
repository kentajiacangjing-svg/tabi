import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { projectForCustomer } from "@/lib/access";
import { all, get } from "@/lib/db";
import { contractForProject, latestQuotesForProject, projectsForCustomer } from "@/lib/queries";
import { compareQuotes } from "@/lib/quote-compare";
import { ButtonLink, EmptyState, PageHeader, cx } from "@/components/ui";
import type { Category, Match } from "@/lib/types";

export const metadata = { title: "見積もりを比べる" };
export const dynamic = "force-dynamic";

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser(["customer"], "/quotes");
  if (!sp.project) {
    const ps = projectsForCustomer(user.id);
    const target = ps.find((p) => p.quote_count > 0) ?? ps[0];
    if (target) redirect(`/quotes?project=${target.id}`);
    return (
      <EmptyState title="まだ見積もりはありません" action={<ButtonLink href="/">相談を始める</ButtonLink>}>
        マッチした会社から見積もりが届くと、ここで比べられます。
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
  const notes = compareQuotes(
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
  );
  const staff = (id: string | null) => (id ? get<{ name: string }>("SELECT name FROM users WHERE id = ?", id)?.name : undefined);

  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader
        back={{ href: `/projects/${project.id}`, label: "相談" }}
        eyebrow={`${category?.name ?? ""}・${project.city}`}
        title="見積もりを比べる"
        description={quotes.length > 1 ? "金額だけでなく、保証と工期、会社の実績も一緒に見てください。" : undefined}
      />

      {quotes.length === 0 ? (
        <EmptyState title="見積もりを待っています" action={<ButtonLink href="/messages" variant="secondary">メッセージを開く</ButtonLink>}>
          会社が現地を確認したあと、SUMATCHで見積もりを送ってきます。
        </EmptyState>
      ) : (
        <div className="space-y-14">
          {quotes.map((q) => {
            const mine = notes.filter((n) => n.companyId === q.company_id);
            const chosen = contract?.quote_id === q.id;
            return (
              <section key={q.id} aria-labelledby={`q-${q.id}`} className={cx(contract && !chosen && "opacity-60")}>
                <div className="flex items-baseline justify-between gap-4">
                  <h2 id={`q-${q.id}`} className="text-[20px] font-medium">
                    {q.company.name}
                  </h2>
                  {chosen && <span className="text-[14px] font-medium text-brand">この会社に決めました</span>}
                </div>
                <div className="mt-3 text-[40px] font-medium leading-none tracking-tight">¥{q.total.toLocaleString("ja-JP")}</div>
                <div className="mt-1 text-[14px] text-muted">税込</div>

                <dl className="mt-6 grid grid-cols-3 gap-4 border-y border-line py-5">
                  <div>
                    <dt className="text-[13px] text-muted">保証</dt>
                    <dd className="mt-1 text-[20px] font-medium">{q.warranty_years ? `${q.warranty_years}年` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-muted">工期</dt>
                    <dd className="mt-1 text-[20px] font-medium">{q.duration_days ? `${q.duration_days}日` : q.duration || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-muted">施工実績</dt>
                    <dd className="mt-1 text-[20px] font-medium">{q.company.works_total.toLocaleString()}件</dd>
                  </div>
                </dl>

                <dl className="mt-1 text-[15px]">
                  <Line label="使用材料" value={q.materials} />
                  <Line label="担当者" value={staff(q.created_by)} />
                  <Line label="口コミ" value={`★ ${q.company.rating_avg.toFixed(1)}（${q.company.review_count}件）`} />
                  <Line label="追加費用" value={q.extra_costs || "記載なし"} />
                </dl>

                {mine.length > 0 && (
                  <ul className="mt-4 space-y-1 text-[14px] leading-relaxed">
                    {mine.map((n, i) => (
                      <li key={i} className={n.tone === "caution" ? "text-warn" : "text-ink-2"}>
                        {n.text}
                      </li>
                    ))}
                  </ul>
                )}

                <Link href={`/quotes/${q.id}`} className="mt-5 inline-flex min-h-11 items-center text-[16px] font-medium text-brand underline-offset-4 hover:underline">
                  詳細を見る
                </Link>
              </section>
            );
          })}
        </div>
      )}

      {waiting.length > 0 && !contract && (
        <p className="mt-14 border-t border-line pt-6 text-[15px] text-muted">
          {waiting.map((w) => w.name).join("、")}の見積もりを待っています。
        </p>
      )}
    </div>
  );
}

function Line({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex gap-4 border-b border-line py-3 last:border-0">
      <dt className="w-20 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 flex-1">{value || "—"}</dd>
    </div>
  );
}
