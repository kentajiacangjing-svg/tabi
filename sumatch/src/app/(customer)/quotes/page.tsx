import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { projectForCustomer } from "@/lib/access";
import { all } from "@/lib/db";
import { contractForProject, latestQuotesForProject, projectsForCustomer } from "@/lib/queries";
import { compareQuotes } from "@/lib/quote-compare";
import { dateJa, man, yen } from "@/lib/format";
import { CompanyAvatar } from "@/components/brand";
import { DecideButton } from "@/components/decide-dialog";
import { Icon } from "@/components/icons";
import { Badge, ButtonLink, EmptyState, Notice, PageHeader, cx } from "@/components/ui";
import type { Match } from "@/lib/types";

export const metadata = { title: "見積もり比較" };
export const dynamic = "force-dynamic";

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser(["customer"], "/quotes");
  if (!sp.project) {
    const withQuotes = projectsForCustomer(user.id).find((p) => p.quote_count > 0) ?? projectsForCustomer(user.id)[0];
    if (withQuotes) redirect(`/quotes?project=${withQuotes.id}`);
    return (
      <EmptyState icon="doc" title="まだ見積もりはありません" action={<ButtonLink href="/diagnosis">無料で相談する</ButtonLink>}>
        マッチした会社から見積もりが届くと、ここで比較できます。
      </EmptyState>
    );
  }
  const project = projectForCustomer(sp.project, user);
  if (!project) redirect("/projects");
  const quotes = latestQuotesForProject(project.id);
  const contract = contractForProject(project.id);
  const matched = all<Match & { name: string }>(
    "SELECT m.*, c.name FROM matches m JOIN companies c ON c.id = m.company_id WHERE m.project_id = ? AND m.status = 'matched'",
    project.id,
  );
  const waiting = matched.filter((m) => !quotes.some((q) => q.match_id === m.id));
  const comments = compareQuotes(
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
  const minTotal = Math.min(...quotes.map((q) => q.total));
  const maxTotal = Math.max(...quotes.map((q) => q.total));

  const rows: { label: string; render: (q: (typeof quotes)[number]) => React.ReactNode }[] = [
    { label: "合計（税込）", render: (q) => <span className="text-[20px] font-bold tracking-tight">{man(q.total, 1)}</span> },
    { label: "工事費小計", render: (q) => yen(q.subtotal) },
    { label: "諸経費", render: (q) => yen(q.overhead) },
    { label: "値引き", render: (q) => (q.discount ? `−${yen(q.discount)}` : "—") },
    { label: "消費税", render: (q) => yen(q.tax) },
    { label: "保証", render: (q) => <span><b>{q.warranty_years ? `${q.warranty_years}年` : "—"}</b><br /><span className="text-muted">{q.warranty}</span></span> },
    { label: "工期", render: (q) => q.duration || "—" },
    { label: "材料", render: (q) => q.materials || "—" },
    { label: "追加費用", render: (q) => (q.extra_costs ? q.extra_costs : <span className="text-warn">記載なし</span>) },
    { label: "支払条件", render: (q) => q.payment_terms || "—" },
    { label: "注意事項・備考", render: (q) => q.notes || "—" },
    { label: "有効期限", render: (q) => dateJa(q.valid_until) },
  ];

  return (
    <div>
      <PageHeader
        back={{ href: `/projects/${project.id}`, label: "相談の詳細" }}
        eyebrow={`${project.city}・${project.title}`}
        title="見積もり比較"
        description="金額だけでなく、保証・工期・追加費用の条件も比べて選びましょう。"
      />

      {contract && (
        <Notice tone="ok" icon="check" className="mb-6">
          依頼先を決定済みです。<Link href={`/projects/${project.id}`} className="font-semibold underline">契約内容を見る</Link>
        </Notice>
      )}

      {quotes.length === 0 ? (
        <EmptyState icon="doc" title="見積もりを待っています" action={<ButtonLink href="/messages" variant="secondary">チャットを開く</ButtonLink>}>
          マッチした会社が現地確認のうえ、SUMATCH上で見積もりを提出します。
        </EmptyState>
      ) : (
        <>
          {/* price overview */}
          <div className="grid gap-3 sm:grid-cols-3">
            {quotes.map((q) => (
              <div key={q.id} className={cx("rounded-3xl border bg-white p-5", contract?.quote_id === q.id ? "border-ok" : "border-line")}>
                <div className="flex items-center gap-2.5">
                  <CompanyAvatar name={q.company.name} color={q.company.brand_color} logoFileId={q.company.logo_file_id} size={32} />
                  <span className="truncate font-bold">{q.company.name}</span>
                </div>
                <div className="mt-4 text-[30px] font-extrabold tracking-tight">{man(q.total, 1)}</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-2">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${maxTotal === minTotal ? 100 : 55 + ((q.total - minTotal) / (maxTotal - minTotal)) * 45}%` }} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {q.total === minTotal && quotes.length > 1 && <Badge tone="brand">最安</Badge>}
                  {q.warranty_years === Math.max(...quotes.map((x) => x.warranty_years)) && quotes.length > 1 && <Badge tone="ok">保証が最長</Badge>}
                  {q.status === "accepted" && <Badge tone="ok">決定</Badge>}
                  {q.version > 1 && <Badge>第{q.version}版</Badge>}
                </div>
              </div>
            ))}
          </div>

          {/* comments */}
          {comments.length > 0 && (
            <div className="mt-6 rounded-3xl border border-line bg-white p-5">
              <div className="mb-3 flex items-center gap-2 font-bold">
                <Icon name="ai" size={18} className="text-brand" />
                比較のポイント
              </div>
              <ul className="space-y-2 text-[13.5px] leading-relaxed">
                {comments.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <Icon name={c.tone === "caution" ? "alert" : "check"} size={16} className={cx("mt-0.5 shrink-0", c.tone === "caution" ? "text-warn" : "text-ok")} />
                    <span>
                      {c.tone === "caution" && <b>{quotes.find((q) => q.company_id === c.companyId)?.company.name}：</b>}
                      {c.text}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-faint">※ 見積もり内容から自動で作成した参考情報です。最終判断は各社への確認のうえで行ってください。</p>
            </div>
          )}

          {/* comparison table */}
          <div className="mt-6 overflow-x-auto rounded-3xl border border-line bg-white">
            <table className="w-full min-w-[640px] table-fixed border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-28 bg-soft px-4 py-3 text-left text-[12px] font-semibold text-muted">項目</th>
                  {quotes.map((q) => (
                    <th key={q.id} className="bg-soft px-4 py-3 text-left font-bold">
                      {q.company.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-t border-line-2 align-top">
                    <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-[12px] font-medium text-muted">{r.label}</th>
                    {quotes.map((q) => (
                      <td key={q.id} className="px-4 py-3 leading-relaxed">
                        {r.render(q)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-line-2 align-top">
                  <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-[12px] font-medium text-muted">内訳</th>
                  {quotes.map((q) => (
                    <td key={q.id} className="px-4 py-3">
                      <details>
                        <summary className="cursor-pointer text-[12px] font-semibold text-brand">{q.items.length}項目を見る</summary>
                        <ul className="mt-2 space-y-1.5">
                          {q.items.map((it) => (
                            <li key={it.id} className="flex justify-between gap-3 text-[12px]">
                              <span className="text-ink-2">
                                {it.name}
                                <span className="text-faint">（{it.quantity}{it.unit}）</span>
                              </span>
                              <span className="shrink-0 tabular-nums">{yen(it.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                      {q.pdf_file_id && (
                        <a href={`/api/files/${q.pdf_file_id}`} target="_blank" rel="noopener" className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-brand">
                          <Icon name="pdf" size={14} />
                          見積書PDF
                        </a>
                      )}
                    </td>
                  ))}
                </tr>
                {!contract && (
                  <tr className="border-t border-line-2">
                    <th className="sticky left-0 z-10 bg-white px-4 py-4" />
                    {quotes.map((q) => (
                      <td key={q.id} className="space-y-2 px-4 py-4">
                        <DecideButton matchId={q.match_id} quoteId={q.id} companyName={q.company.name} amount={q.total} />
                        <Link href={`/messages/${q.match_id}`} className="block text-center text-[12px] font-semibold text-ink-2 hover:underline">
                          チャットで質問する
                        </Link>
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {waiting.length > 0 && !contract && (
        <div className="mt-6 rounded-3xl border border-dashed border-line p-5 text-sm">
          <div className="font-semibold">見積もり待ち</div>
          <ul className="mt-2 space-y-1 text-muted">
            {waiting.map((w) => (
              <li key={w.id} className="flex items-center justify-between">
                <span>{w.name}</span>
                <Link href={`/messages/${w.id}`} className="text-[13px] font-semibold text-brand">チャット</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
