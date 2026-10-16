import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { all } from "@/lib/db";
import { dateShort, man } from "@/lib/format";
import { Badge, ButtonLink, EmptyState, PageHeader, cx } from "@/components/ui";
import { Icon } from "@/components/icons";

export const metadata = { title: "見積もり" };
export const dynamic = "force-dynamic";

const STATUS = { submitted: ["提出済み", "brand"], superseded: ["旧版", "neutral"], accepted: ["採用", "ok"], declined: ["不採用", "neutral"] } as const;

export default async function BusinessQuotes({ searchParams }: { searchParams: Promise<{ match?: string }> }) {
  const { match } = await searchParams;
  const { membership } = await requireBusiness();
  const quotes = all<{ id: string; match_id: string; title: string; total: number; status: keyof typeof STATUS; version: number; created_at: string; city: string; customer: string; warranty_years: number; duration: string; pdf_file_id: string | null }>(
    `SELECT q.id, q.match_id, q.title, q.total, q.status, q.version, q.created_at, q.warranty_years, q.duration, q.pdf_file_id, p.city, u.name AS customer
       FROM quotes q JOIN projects p ON p.id = q.project_id JOIN users u ON u.id = p.customer_id
      WHERE q.company_id = ? ${match ? "AND q.match_id = ?" : ""} ORDER BY q.created_at DESC`,
    ...[membership.company.id, ...(match ? [match] : [])],
  );
  const awaiting = all<{ id: string; city: string; customer: string; title: string }>(
    `SELECT m.id, p.city, p.title, u.name AS customer FROM matches m JOIN projects p ON p.id = m.project_id JOIN users u ON u.id = p.customer_id
      WHERE m.company_id = ? AND m.status = 'matched' AND p.status IN ('consulting','quoting','comparing')
        AND NOT EXISTS (SELECT 1 FROM quotes q WHERE q.match_id = m.id) ORDER BY m.matched_at`,
    membership.company.id,
  );
  return (
    <div className="max-w-4xl">
      <PageHeader title="見積もり" description="SUMATCH上で提出した見積もりは、お客様の比較画面にそのまま表示されます。" />
      {awaiting.length > 0 && !match && (
        <div className="mb-6 rounded-3xl border border-line bg-white p-5">
          <div className="mb-3 font-bold">見積もり未提出のお客様</div>
          <ul className="divide-y divide-line-2">
            {awaiting.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 truncate text-sm">{a.customer}様・{a.city}・{a.title}</span>
                <ButtonLink href={`/business/quotes/new?match=${a.id}`} size="sm">作成</ButtonLink>
              </li>
            ))}
          </ul>
        </div>
      )}
      {quotes.length === 0 ? (
        <EmptyState icon="doc" title="提出した見積もりはありません" />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-line bg-white">
          {quotes.map((q) => (
            <div key={q.id} className={cx("flex items-center gap-3 border-b border-line-2 px-4 py-3.5 last:border-0", q.status === "superseded" && "opacity-60")}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge tone={STATUS[q.status][1]}>{STATUS[q.status][0]}</Badge>
                  {q.version > 1 && <span className="text-[11px] text-faint">第{q.version}版</span>}
                  <span className="text-[12px] text-faint">{dateShort(q.created_at)}</span>
                </div>
                <div className="mt-1 truncate font-semibold">{q.customer}様・{q.city}</div>
                <div className="truncate text-[12px] text-muted">{q.title}・保証{q.warranty_years}年・{q.duration}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{man(q.total, 1)}</div>
                <div className="flex justify-end gap-2 text-[12px]">
                  {q.pdf_file_id && <a href={`/api/files/${q.pdf_file_id}`} target="_blank" rel="noopener" className="text-brand"><Icon name="pdf" size={14} /></a>}
                  <Link href={`/business/messages/${q.match_id}`} className="font-semibold text-brand">チャット</Link>
                  {q.status === "submitted" && <Link href={`/business/quotes/new?match=${q.match_id}`} className="font-semibold text-brand">改訂</Link>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
