// Every estimate side by side, item by item. Phones: the item column stays put and the companies scroll
// sideways. Nothing is scored or ranked here — a missing item reads 「未提示」, never a guess.
import Link from "next/link";
import type { ReactNode } from "react";
import { dateJa, yen } from "@/lib/format";
import type { Company, Quote, QuoteItem } from "@/lib/types";
import { cx } from "./ui";

type Q = Quote & { items: QuoteItem[]; company: Company };

const NONE = <span className="text-faint">未提示</span>;
const text = (v: string | null | undefined) => (v && v.trim() ? <span className="whitespace-pre-wrap">{v}</span> : NONE);

export function QuoteTable({ quotes, chosenQuoteId, decided }: { quotes: Q[]; chosenQuoteId: string | null; decided: boolean }) {
  const rows: { label: string; cell: (q: Q) => ReactNode }[] = [
    {
      label: "税込総額",
      cell: (q) => (
        <>
          <span className="tnum text-[18px] font-semibold">{yen(q.total)}</span>
          <span className="mt-0.5 block text-[12px] text-muted">第{q.version}版・{dateJa(q.created_at)}</span>
        </>
      ),
    },
    {
      label: "内訳",
      cell: (q) =>
        q.items.length ? (
          <ul className="space-y-1">
            {q.items.map((it) => (
              <li key={it.id} className="flex justify-between gap-3">
                <span className="min-w-0">{it.name}</span>
                <span className="tnum shrink-0">{yen(it.amount)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 text-muted">
              <span>諸経費{q.discount > 0 ? "・値引き" : ""}</span>
              <span className="tnum shrink-0">{yen(q.overhead - q.discount)}</span>
            </li>
            <li className="flex justify-between gap-3 text-muted">
              <span>消費税</span>
              <span className="tnum shrink-0">{yen(q.tax)}</span>
            </li>
          </ul>
        ) : (
          NONE
        ),
    },
    { label: "施工範囲", cell: (q) => text(q.title) },
    { label: "材料", cell: (q) => text(q.materials) },
    {
      label: "工期・開始予定",
      cell: (q) => (
        <>
          {q.duration || q.duration_days ? <span>{q.duration || `約${q.duration_days}日`}</span> : NONE}
          <span className="mt-0.5 block text-[12px] text-muted">開始日は依頼先決定後に契約条件で確認</span>
        </>
      ),
    },
    { label: "保証", cell: (q) => text(q.warranty || (q.warranty_years ? `${q.warranty_years}年` : "")) },
    { label: "有効期限", cell: (q) => (q.valid_until ? dateJa(q.valid_until) : NONE) },
    { label: "追加費用の条件", cell: (q) => text(q.extra_costs) },
    { label: "支払条件", cell: (q) => text(q.payment_terms) },
    {
      label: "会社情報",
      cell: (q) => (
        <span className="block space-y-0.5">
          <span className="block">{q.company.review_count > 0 ? `★${q.company.rating_avg.toFixed(1)}（口コミ${q.company.review_count}件）` : "口コミはまだありません"}</span>
          {q.company.founded_year ? <span className="block text-muted">{q.company.founded_year}年創業</span> : null}
          {q.company.license_number ? <span className="block text-muted">建設業許可あり</span> : null}
        </span>
      ),
    },
  ];

  return (
    <section aria-labelledby="compare-table" className="mt-12">
      <h2 id="compare-table" className="text-[20px] font-medium">
        項目ごとに比べる
      </h2>
      <p className="mt-1 text-[14px] text-muted">{quotes.length > 2 ? "横にスクロールすると、ほかの会社も見られます。" : "会社から届いた内容をそのまま並べています。"}</p>
      <div className="mt-4 overflow-x-auto rounded-[24px] bg-surface shadow-[var(--shadow-card)]" role="region" aria-label="見積の比較表" tabIndex={0}>
        <table className="w-full min-w-max border-collapse text-left text-[14px] leading-relaxed">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-24 bg-surface px-3 py-3 text-[13px] font-medium text-muted sm:w-32 sm:px-4">
                <span className="sr-only">項目</span>
              </th>
              {quotes.map((q) => (
                <th key={q.id} scope="col" className="w-[min(72vw,260px)] min-w-[200px] border-l border-line px-4 py-3 align-bottom">
                  <span className="block text-[15px] font-semibold">{q.company.name}</span>
                  {chosenQuoteId === q.id && <span className="mt-1 inline-block rounded-full bg-brand px-2 py-0.5 text-[12px] font-medium text-white">依頼先</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-line align-top">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-3 text-[13px] font-medium text-ink-2 sm:px-4">
                  {r.label}
                </th>
                {quotes.map((q) => (
                  <td key={q.id} className={cx("border-l border-line px-4 py-3", decided && chosenQuoteId !== q.id && "text-muted")}>
                    {r.cell(q)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-line align-top">
              <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-3 text-[13px] font-medium text-ink-2 sm:px-4">
                次の操作
              </th>
              {quotes.map((q) => (
                <td key={q.id} className="border-l border-line px-4 py-3">
                  <div className="flex flex-col gap-1.5">
                    <Link href={`/quotes/${q.id}`} className="flex min-h-11 items-center justify-center rounded-xl border border-line px-3 text-[14px] font-medium hover:border-ink/25">
                      {decided ? "見積を見る" : "詳細を見て決める"}
                    </Link>
                    <Link href={`/messages/${q.match_id}`} className="flex min-h-11 items-center justify-center rounded-xl px-3 text-[14px] text-brand hover:bg-soft">
                      メッセージで聞く
                    </Link>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
