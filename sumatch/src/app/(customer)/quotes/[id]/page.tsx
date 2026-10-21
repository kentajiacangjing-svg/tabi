import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { projectForCustomer } from "@/lib/access";
import { get } from "@/lib/db";
import { contractForProject, quoteWithItems } from "@/lib/queries";
import { latestQuoteForMatch } from "@/lib/contract";
import { dateJa, yen } from "@/lib/format";
import { DecideButton } from "@/components/decide-dialog";
import { Notice, Row } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { Quote } from "@/lib/types";

export const metadata = { title: "見積" };
export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ old?: string }> }) {
  const { id } = await params;
  const { old } = await searchParams;
  const user = await requireUser(["customer"], `/quotes/${id}`);
  const raw = get<Quote>("SELECT * FROM quotes WHERE id = ?", id);
  const project = raw ? projectForCustomer(raw.project_id, user) : null;
  if (!raw || !project) notFound();
  // An old version is never shown as decidable: send the customer to the version the company stands behind now.
  const latest = latestQuoteForMatch(raw.match_id);
  if (raw.status === "superseded" || (latest && latest.id !== raw.id)) {
    if (latest) redirect(`/quotes/${latest.id}?old=${raw.version}`);
    notFound();
  }
  const q = quoteWithItems(raw);
  const contract = contractForProject(project.id);
  const staff = q.created_by ? get<{ name: string }>("SELECT name FROM users WHERE id = ?", q.created_by)?.name : undefined;

  return (
    <div className="mx-auto max-w-[680px]">
      <Link href={`/quotes?project=${project.id}`} className="-ml-1 mb-4 inline-flex min-h-11 items-center gap-1 text-[15px] text-muted hover:text-ink">
        <Icon name="chevron-left" size={18} />
        見積を比べる
      </Link>
      {old && <Notice className="mb-6">この見積は更新されました。最新の第{q.version}版を表示しています（以前の版：第{old}版）。</Notice>}
      <p className="text-[15px] text-muted">{q.company.name}</p>
      <h1 className="mt-1 text-[24px] font-medium">{q.title}</h1>
      <div className="mt-6 text-[44px] font-medium leading-none tracking-tight">¥{q.total.toLocaleString("ja-JP")}</div>
      <div className="mt-1 text-[14px] text-muted">税込・第{q.version}版{q.version > 1 ? "（最新）" : ""}</div>

      <div className="mt-10">
        <Row label="保証">{q.warranty || "—"}</Row>
        <Row label="工期">{q.duration || "—"}</Row>
        <Row label="使用材料">{q.materials || "—"}</Row>
        <Row label="支払い">{q.payment_terms || "—"}</Row>
        <Row label="追加費用">{q.extra_costs || "記載なし"}</Row>
        <Row label="担当者">{staff ?? "—"}</Row>
        <Row label="有効期限">{dateJa(q.valid_until)}</Row>
      </div>

      <h2 className="mt-14 text-[20px] font-medium">内訳</h2>
      <ul className="mt-3">
        {q.items.map((it) => (
          <li key={it.id} className="flex items-baseline justify-between gap-4 border-b border-line py-3 text-[15px]">
            <span>
              {it.name}
              <span className="ml-2 text-[13px] text-muted">
                {it.quantity}
                {it.unit}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">{yen(it.amount)}</span>
          </li>
        ))}
        <li className="flex justify-between border-b border-line py-3 text-[15px] text-muted">
          <span>諸経費</span>
          <span className="tabular-nums">{yen(q.overhead)}</span>
        </li>
        {q.discount > 0 && (
          <li className="flex justify-between border-b border-line py-3 text-[15px] text-muted">
            <span>値引き</span>
            <span className="tabular-nums">−{yen(q.discount)}</span>
          </li>
        )}
        <li className="flex justify-between border-b border-line py-3 text-[15px] text-muted">
          <span>消費税</span>
          <span className="tabular-nums">{yen(q.tax)}</span>
        </li>
      </ul>
      {q.notes && <p className="mt-6 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-2">{q.notes}</p>}
      {q.pdf_file_id && (
        <a href={`/api/files/${q.pdf_file_id}`} target="_blank" rel="noopener" className="mt-6 inline-flex min-h-11 items-center text-[15px] text-ink underline underline-offset-4">
          見積書のPDFを開く
        </a>
      )}

      <div className="mt-14">
        {contract ? (
          <p className="text-[15px] text-muted">{contract.quote_id === q.id ? "この見積で依頼先を決めました。契約条件は相談ページで確認できます。" : "この相談は別の会社に決まりました。"}</p>
        ) : (
          <>
            <DecideButton matchId={q.match_id} quoteId={q.id} companyName={q.company.name} amount={q.total} version={q.version} />
            <Link href={`/messages/${q.match_id}`} className="mt-3 flex min-h-11 items-center justify-center text-[15px] text-muted hover:text-ink">
              わからない点をメッセージで聞く
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
