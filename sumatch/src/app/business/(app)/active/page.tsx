import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { all } from "@/lib/db";
import { PROJECT_STATUS } from "@/lib/constants";
import { relative } from "@/lib/format";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import type { ProjectStatus } from "@/lib/types";

export const metadata = { title: "進行中の相談" };
export const dynamic = "force-dynamic";

interface ActiveRow {
  match_id: string;
  project_id: string;
  city: string;
  category: string;
  customer: string;
  status: string;
  company_response: string;
  customer_interest: number;
  project_status: ProjectStatus;
  quote_total: number | null;
  last_at: string | null;
  won: number;
}

export default async function ActivePage() {
  const { membership } = await requireBusiness();
  const rows = all<ActiveRow>(
    `SELECT m.id AS match_id, p.id AS project_id, p.city, c.name AS category, u.name AS customer, m.status, m.company_response, m.customer_interest,
            p.status AS project_status, m.last_message_at AS last_at,
            (SELECT total FROM quotes q WHERE q.match_id = m.id AND q.status != 'superseded' ORDER BY version DESC LIMIT 1) AS quote_total,
            EXISTS (SELECT 1 FROM contracts ct WHERE ct.match_id = m.id) AS won
       FROM matches m JOIN projects p ON p.id = m.project_id JOIN categories c ON c.id = p.category_id JOIN users u ON u.id = p.customer_id
      WHERE m.company_id = ? AND (m.status = 'matched' OR m.company_response != 'none')
      ORDER BY COALESCE(m.last_message_at, m.company_response_at) DESC`,
    membership.company.id,
  );
  const open = (s: ProjectStatus) => ["consulting", "quoting", "comparing"].includes(s);
  const groups: { title: string; rows: ActiveRow[]; detail: (r: ActiveRow) => string }[] = [
    { title: "メッセージ中", rows: rows.filter((r) => r.status === "matched" && open(r.project_status) && !r.quote_total), detail: () => "見積はまだです" },
    { title: "見積提出済み", rows: rows.filter((r) => r.status === "matched" && open(r.project_status) && r.quote_total), detail: (r) => `¥${r.quote_total!.toLocaleString("ja-JP")}・お客様が比較中` },
    { title: "契約・工事", rows: rows.filter((r) => r.won), detail: (r) => PROJECT_STATUS[r.project_status].label },
    { title: "お客様の返事待ち", rows: rows.filter((r) => r.status !== "matched" && r.company_response === "yes" && open(r.project_status)), detail: () => "「対応したい」を送りました" },
  ];
  const hasAny = groups.some((g) => g.rows.length);
  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader title="進行中の相談" />
      {!hasAny && (
        <EmptyState icon="doc" title="進行中の案件はまだありません" action={<ButtonLink href="/business/leads">新しい相談を見る</ButtonLink>}>「対応したい」を送った相談がマッチすると、ここに並びます。</EmptyState>
      )}
      <div className="space-y-12">
        {groups
          .filter((g) => g.rows.length)
          .map((g) => (
            <section key={g.title}>
              <h2 className="text-[15px] text-muted">
                {g.title}　{g.rows.length}
              </h2>
              <ul className="mt-2 divide-y divide-line border-y border-line">
                {g.rows.map((r) => (
                  <li key={r.match_id}>
                    <Link href={r.status === "matched" ? `/business/messages/${r.match_id}` : `/business/leads/${r.project_id}`} className="flex min-h-[72px] items-center justify-between gap-4 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-[17px] font-medium">
                          {r.status === "matched" ? `${r.customer}様` : r.city}・{r.category}
                        </span>
                        <span className="block text-[14px] text-muted">{g.detail(r)}</span>
                      </span>
                      <span className="shrink-0 text-[13px] text-faint">{relative(r.last_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>
    </div>
  );
}
