// 依頼先決定 → 契約条件 → 双方の合意. Shown to the customer on the project page and to the company on
// /business/contract/[id]. Server component: reads the contract, its terms and its history.
import Link from "next/link";
import { get } from "@/lib/db";
import { contractHistory, effectiveStage, termsOf, verifyContractHistory } from "@/lib/contract";
import { AGREEMENT_NOTE, STAGE_LABEL, TERM_FIELDS, missingTerms, type TermKey } from "@/lib/contract-terms";
import { dateJa, yen } from "@/lib/format";
import { fileUrl } from "@/lib/urls";
import type { Company, Contract, Quote } from "@/lib/types";
import { AgreeButton, ContractFileForm, TermsForm } from "./contract-actions";
import { AdvanceContractButton } from "./project-actions";
import { Notice, Row, cx } from "./ui";

const EVENT_LABEL: Record<string, string> = {
  selected: "依頼先に決定",
  terms_proposed: "契約条件を提示",
  terms_updated: "契約条件を更新",
  quote_revised: "見積を改訂（同意を取り消し）",
  agreed: "契約条件に同意",
  both_agreed: "双方の合意を確認",
  document_attached: "契約書を添付",
  work_started: "工事開始",
  work_completed: "工事完了",
};
const SIDE_LABEL = { customer: "お客様", company: "施工会社", system: "SUMATCH" } as const;

function dateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ContractPanel({ contract: c, viewer }: { contract: Contract; viewer: "customer" | "company" }) {
  const company = get<Company>("SELECT * FROM companies WHERE id = ?", c.company_id)!;
  const quote = c.quote_id ? get<Quote>("SELECT * FROM quotes WHERE id = ?", c.quote_id) : null;
  const stage = effectiveStage(c);
  const terms = termsOf(c);
  const missing = terms ? missingTerms(terms) : [];
  const ready = !!terms && !!c.terms_hash && missing.length === 0;
  const mine = viewer === "customer" ? c.customer_agreed_at : c.company_agreed_at;
  const theirs = viewer === "customer" ? c.company_agreed_at : c.customer_agreed_at;
  const history = contractHistory(c.id);
  const intact = verifyContractHistory(c.id);
  const steps: { key: string; label: string; done: boolean }[] = [
    { key: "selected", label: "依頼先決定", done: true },
    { key: "terms", label: "契約条件の確認", done: stage !== "selected" },
    { key: "agreed", label: "双方の合意", done: stage === "agreed" },
  ];
  const initial = Object.fromEntries(
    TERM_FIELDS.map((f) => [
      f.key,
      terms?.[f.key] ??
        (quote
          ? ({ scope: quote.title, duration: quote.duration, materials: quote.materials, payment_terms: quote.payment_terms, warranty: quote.warranty, extra_work: quote.extra_costs } as Partial<Record<TermKey, string>>)[f.key] ?? ""
          : ""),
    ]),
  ) as Record<TermKey, string>;

  return (
    <section id="contract" className="scroll-mt-24">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[20px] font-medium">依頼先と契約条件</h2>
        <span className={cx("rounded-full px-3 py-1 text-[13px] font-medium", stage === "agreed" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn")}>{STAGE_LABEL[stage]}</span>
      </div>
      <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="進み具合">
        {steps.map((s, i) => (
          <li key={s.key} className={cx("rounded-xl px-3 py-2 text-center text-[13px]", s.done ? "bg-brand-soft font-medium text-brand-ink" : "bg-soft text-muted")}>
            <span className="tabular-nums">{i + 1}.</span> {s.label}
            {s.done && <span className="sr-only">（済）</span>}
          </li>
        ))}
      </ol>

      <div className="mt-5">
        <Row label={viewer === "customer" ? "依頼先" : "お客様の相談"}>
          <Link href={viewer === "customer" ? `/messages/${c.match_id}` : `/business/messages/${c.match_id}`} className="underline underline-offset-4">
            {viewer === "customer" ? company.name : "メッセージを開く"}
          </Link>
        </Row>
        <Row label="金額（税込）">
          <span className="tabular-nums">{yen(c.amount)}</span>
          {quote && <span className="ml-2 text-[13px] text-muted">見積 第{quote.version}版</span>}
        </Row>
      </div>

      {stage === "selected" && !ready && (
        <Notice tone="neutral" className="mt-5">
          {viewer === "customer"
            ? `${company.name}が契約条件（工事範囲・日程・支払条件・保証など）を準備しています。届いたらお知らせします。この時点では契約は成立していません。`
            : "お客様が御社を依頼先に選びました。下のフォームで契約条件を入力してください。条件がそろうまで、契約や工事開始の扱いにはなりません。"}
        </Notice>
      )}

      {terms && (
        <div className="mt-6">
          <h3 className="text-[15px] font-medium text-ink-2">契約条件{c.terms_hash && <span className="ml-2 text-[12px] font-normal text-muted">確認番号 {c.terms_hash.slice(0, 8)}</span>}</h3>
          <dl className="mt-2 divide-y divide-line border-y border-line">
            {TERM_FIELDS.map((f) => (
              <div key={f.key} className="grid gap-1 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
                <dt className="text-[14px] text-muted">{f.label}</dt>
                <dd className={cx("whitespace-pre-wrap text-[15px] leading-relaxed", !terms[f.key] && "text-danger")}>{f.type === "date" && terms[f.key] ? dateJa(terms[f.key]) : terms[f.key] || "未入力"}</dd>
              </div>
            ))}
          </dl>
          {missing.length > 0 && <Notice tone="danger" className="mt-3">未入力の項目があります：{missing.join("・")}</Notice>}
        </div>
      )}

      {ready && stage !== "agreed" && (
        <div className="mt-6 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-[14px]">
            <div className="rounded-xl bg-soft px-3 py-2">
              <div className="text-muted">お客様</div>
              <div className="font-medium">{c.customer_agreed_at ? `同意済み（${dateTime(c.customer_agreed_at)}）` : "未同意"}</div>
            </div>
            <div className="rounded-xl bg-soft px-3 py-2">
              <div className="text-muted">施工会社</div>
              <div className="font-medium">{c.company_agreed_at ? `同意済み（${dateTime(c.company_agreed_at)}）` : "未同意"}</div>
            </div>
          </div>
          {mine ? (
            <Notice tone="ok">あなたは同意済みです。{theirs ? "" : viewer === "customer" ? `${company.name}の同意を待っています。` : "お客様の同意を待っています。"}</Notice>
          ) : (
            <AgreeButton contractId={c.id} termsHash={c.terms_hash} />
          )}
          <p className="text-[13px] leading-relaxed text-muted">{AGREEMENT_NOTE}</p>
        </div>
      )}

      {stage === "agreed" && (
        <div className="mt-6 space-y-4">
          <Notice tone="ok">
            双方の合意を確認しました（{dateTime(c.agreed_at)}）。{AGREEMENT_NOTE}
          </Notice>
          <div>
            {c.contract_file_id ? (
              <Row label="契約書">
                <a href={fileUrl(c.contract_file_id)!} target="_blank" rel="noopener" className="underline underline-offset-4">
                  開く
                </a>
              </Row>
            ) : (
              viewer === "customer" && <p className="text-[14px] text-muted">契約書は{company.name}から受け取ってください。添付されるとここから開けます。</p>
            )}
            {c.end_date && <Row label="完了日">{dateJa(c.end_date)}</Row>}
          </div>
          {viewer === "company" && <ContractFileForm contractId={c.id} />}
          <div>
            {c.status === "contracted" && <AdvanceContractButton contractId={c.id} to="in_progress" label="工事が始まった" />}
            {c.status === "in_progress" && <AdvanceContractButton contractId={c.id} to="completed" label="工事が終わった" variant="primary" />}
          </div>
        </div>
      )}

      {viewer === "company" && stage !== "agreed" && (
        <div className="mt-8">
          <h3 className="mb-4 text-[17px] font-medium">{terms ? "契約条件を変更する" : "契約条件を入力する"}</h3>
          <TermsForm contractId={c.id} initial={initial} hasTerms={!!terms} />
        </div>
      )}

      {history.length > 0 && (
        <details className="mt-8 rounded-xl border border-line px-4 py-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-[15px] text-ink-2">記録（{history.length}件）</summary>
          {!intact && <Notice tone="danger" className="mt-2">記録の整合性を確認できませんでした。運営にお問い合わせください。</Notice>}
          <ol className="mt-2 space-y-2 text-[14px]">
            {history.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-x-4 border-b border-line pb-2 last:border-0">
                <span>
                  {SIDE_LABEL[e.actor_side]}：{EVENT_LABEL[e.action] ?? e.action}
                  {e.terms_hash && <span className="ml-2 text-[12px] text-muted">#{e.terms_hash.slice(0, 8)}</span>}
                </span>
                <span className="text-muted">{dateTime(e.created_at)}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
