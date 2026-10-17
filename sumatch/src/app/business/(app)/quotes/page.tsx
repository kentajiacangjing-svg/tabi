import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { all } from "@/lib/db";
import { dateShort, man } from "@/lib/format";
import { Badge, ButtonLink, EmptyState, PageHeader, cx } from "@/components/ui";
import { Icon } from "@/components/icons";

export const metadata = { title: "見積" };
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
    <div className="mx-auto max-w-[760px]">
      <PageHeader title="見積" description="提出した見積は、そのままお客様の比較画面に並びます。" />
      {awaiting.length > 0 && !match && (
        <div className="mb-14">
          <h2 className="text-[15px] text-muted">まだ見積を出していない相談</h2>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {awaiting.map((a) => (
              <li key={a.id} className="flex min-h-16 items-center justify-between gap-3 py-3">
                <span className="min-w-0 truncate text-[16px]">{a.customer}様・{a.city}・{a.title}</span>
                <ButtonLink href={`/business/quotes/new?match=${a.id}`} size="sm">見積を作る</ButtonLink>
              </li>
            ))}
          </ul>
        </div>
      )}
      {quotes.length === 0 ? (
        <EmptyState title="提出した見積はまだありません" />
      ) : (
        <div className="divide-y divide-line border-y border-line">
          {quotes.map((q) => (
            <div key={q.id} className={cx("flex items-center gap-4 py-4", q.status === "superseded" && "opacity-50")}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge tone={STATUS[q.status][1]}>{STATUS[q.status][0]}</Badge>
                  {q.version > 1 && <span className="text-[13px] text-faint">第{q.version}版</span>}
                  <span className="text-[13px] text-faint">{dateShort(q.created_at)}</span>
                </div>
                <div className="mt-1 truncate text-[17px] font-medium">{q.customer}様・{q.city}</div>
                <div className="truncate text-[14px] text-muted">{q.title}・保証{q.warranty_years}年・{q.duration}</div>
              </div>
              <div className="text-right">
                <div className="text-[20px] font-medium">¥{q.total.toLocaleString("ja-JP")}</div>
                <div className="mt-1 flex justify-end gap-3 text-[14px]">
                  {q.pdf_file_id && <a href={`/api/files/${q.pdf_file_id}`} target="_blank" rel="noopener" className="text-brand"><Icon name="pdf" size={14} /></a>}
                  <Link href={`/business/messages/${q.match_id}`} className="text-brand">メッセージ</Link>
                  {q.status === "submitted" && <Link href={`/business/quotes/new?match=${q.match_id}`} className="text-brand">作り直す</Link>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
