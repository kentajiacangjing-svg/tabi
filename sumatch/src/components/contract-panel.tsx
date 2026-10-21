// 依頼先決定 → 契約条件 → 双方の合意 → 契約成立. Shown to the customer on the project page and to the company on
// /business/contract/[id]. Server component: reads the contract, its terms, its history and (after 契約成立) contacts.
import Link from "next/link";
import { get } from "@/lib/db";
import { contractContactsFor, contractHistory, effectiveStage, establishmentChecks, termsLocked, termsOf, verifyContractHistory } from "@/lib/contract";
import { AGREEMENT_NOTE, STAGE_LABEL, TERM_FIELDS, TEST_OPERATION_NOTE, missingTerms, type TermKey } from "@/lib/contract-terms";
import { quoteWithItems } from "@/lib/queries";
import { dateJa, yen } from "@/lib/format";
import { fileUrl } from "@/lib/urls";
import type { Company, Contract, Quote } from "@/lib/types";
import { AgreeButton, ContactForm, ContractFileForm, TermsForm } from "./contract-actions";
import { AdvanceContractButton } from "./project-actions";
import { Notice, Row, cx } from "./ui";

const EVENT_LABEL: Record<string, string> = {
  selected: "依頼先に決定",
  terms_proposed: "契約条件を提示",
  terms_updated: "契約条件を更新",
  quote_revised: "見積を改訂（同意を取り消し）",
  agreed: "契約条件に同意",
  both_agreed: "双方の合意を確認",
  document_attached: "契約書を登録",
  document_replaced: "契約書を差し替え（確認を取り消し）",
  document_confirmed: "契約書の内容を確認",
  contract_established: "契約成立の要件を満たした",
  contact_updated: "連絡先を登録・更新",
  work_started: "工事開始",
  work_completed: "工事完了",
};
const SIDE_LABEL = { customer: "お客様", company: "施工会社", system: "SUMATCH" } as const;

function dateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ContractPanel({ contract: c, viewer, viewerUserId }: { contract: Contract; viewer: "customer" | "company"; viewerUserId: string }) {
  const company = get<Company>("SELECT * FROM companies WHERE id = ?", c.company_id)!;
  const quote = c.quote_id ? get<Quote>("SELECT * FROM quotes WHERE id = ?", c.quote_id) : null;
  const stage = effectiveStage(c);
  const terms = termsOf(c);
  const missing = terms ? missingTerms(terms) : [];
  const ready = !!terms && !!c.terms_hash && missing.length === 0;
  const mine = viewer === "customer" ? c.customer_agreed_at : c.company_agreed_at;
  const theirs = viewer === "customer" ? c.company_agreed_at : c.customer_agreed_at;
  const locked = termsLocked(c);
  const checks = establishmentChecks(c);
  const docMine = viewer === "customer" ? c.customer_doc_confirmed_at : c.company_doc_confirmed_at;
  const contacts = contractContactsFor(c, { side: viewer, userId: viewerUserId });
  const quoteItems = quote ? quoteWithItems(quote) : null;
  const history = contractHistory(c.id);
  const intact = verifyContractHistory(c.id);
  const steps: { key: string; label: string; done: boolean }[] = [
    { key: "selected", label: "依頼先決定", done: true },
    { key: "terms", label: "契約条件の確認", done: stage !== "selected" },
    { key: "agreed", label: "双方の合意", done: locked },
    { key: "contracted", label: "契約成立", done: stage === "contracted" },
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
        <span className={cx("rounded-full px-3 py-1 text-[13px] font-medium", stage === "contracted" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn")}>{STAGE_LABEL[stage]}</span>
      </div>
      <Notice tone="warn" className="mt-4">
        {TEST_OPERATION_NOTE}
      </Notice>
      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="進み具合">
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
      {quoteItems && (
        <details className="mt-2 rounded-xl border border-line px-4 py-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-[14px] text-ink-2">金額の内訳（見積 第{quoteItems.version}版）</summary>
          <ul className="pb-2 text-[14px]">
            {quoteItems.items.map((it) => (
              <li key={it.id} className="flex justify-between gap-3 border-b border-line py-2">
                <span className="min-w-0">{it.name}</span>
                <span className="tabular-nums">{yen(it.amount)}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 border-b border-line py-2 text-muted">
              <span>諸経費{quoteItems.discount > 0 ? "・値引き" : ""}</span>
              <span className="tabular-nums">{yen(quoteItems.overhead - quoteItems.discount)}</span>
            </li>
            <li className="flex justify-between gap-3 py-2 text-muted">
              <span>消費税</span>
              <span className="tabular-nums">{yen(quoteItems.tax)}</span>
            </li>
          </ul>
        </details>
      )}

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

      {ready && !locked && (
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

      {locked && (
        <div className="mt-6 space-y-5">
          <Notice tone="ok">
            双方が契約条件に合意しました（{dateTime(c.agreed_at)}）。{AGREEMENT_NOTE}
          </Notice>

          <div>
            <h3 className="text-[15px] font-medium text-ink-2">契約成立の要件</h3>
            <ul className="mt-2 space-y-1.5 text-[14px]">
              {checks.map((x) => (
                <li key={x.key} className="flex items-start gap-2">
                  <span className={cx("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[12px] font-semibold", x.ok ? "bg-ok-soft text-ok" : "bg-soft text-muted")} aria-hidden="true">
                    {x.ok ? "✓" : "・"}
                  </span>
                  <span className={x.ok ? "" : "text-muted"}>
                    {x.label}
                    <span className="sr-only">{x.ok ? "（済）" : "（未）"}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            {c.contract_file_id ? (
              <>
                <Row label="契約書">
                  <a href={fileUrl(c.contract_file_id)!} target="_blank" rel="noopener" className="underline underline-offset-4">
                    開く
                  </a>
                  <span className="ml-2 text-[12px] text-muted">確認番号 {c.contract_file_hash.slice(0, 8)}</span>
                </Row>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[14px]">
                  <div className="rounded-xl bg-soft px-3 py-2">
                    <div className="text-muted">お客様</div>
                    <div className="font-medium">{c.customer_doc_confirmed_at ? `確認済み（${dateTime(c.customer_doc_confirmed_at)}）` : "未確認"}</div>
                  </div>
                  <div className="rounded-xl bg-soft px-3 py-2">
                    <div className="text-muted">施工会社</div>
                    <div className="font-medium">{c.company_doc_confirmed_at ? `確認済み（${dateTime(c.company_doc_confirmed_at)}）` : "未確認"}</div>
                  </div>
                </div>
                {stage === "agreed" &&
                  (docMine ? (
                    <Notice tone="ok" className="mt-3">
                      あなたは契約書を確認済みです。{viewer === "customer" ? `${company.name}の確認を待っています。` : "お客様の確認を待っています。"}
                    </Notice>
                  ) : (
                    <div className="mt-3">
                      <AgreeButton
                        contractId={c.id}
                        termsHash={c.contract_file_hash}
                        kind="document"
                        label="契約書の内容を確認した"
                        checkLabel="登録された契約書を開き、内容が上の契約条件と一致していることを確認しました。"
                      />
                    </div>
                  ))}
              </>
            ) : (
              <p className="text-[14px] text-muted">
                {viewer === "customer" ? `${company.name}が契約書（工事請負契約書）を登録すると、ここで内容を確認できます。` : "契約書（工事請負契約書）を登録してください。"}
              </p>
            )}
            {c.end_date && <Row label="完了日">{dateJa(c.end_date)}</Row>}
          </div>
          {viewer === "company" && stage === "agreed" && <ContractFileForm contractId={c.id} replacing={!!c.contract_file_id} />}

          {contacts && (
            <div className="rounded-2xl border border-line p-4 sm:p-5">
              <h3 className="text-[17px] font-medium">連絡先</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">工事のために必要な範囲でお使いください。相手の連絡先を表示したことは記録されます。連絡先はチャットでは送れません。</p>
              <div className="mt-4">
                <div className="text-[14px] font-medium text-ink-2">{viewer === "customer" ? company.name : "お客様"}の連絡先</div>
                {contacts.theirs ? (
                  <dl className="mt-2 divide-y divide-line border-y border-line text-[15px]">
                    {(
                      [
                        [viewer === "customer" ? "担当者" : "お名前", contacts.theirs.name],
                        ["電話番号", contacts.theirs.phone],
                        ["メール", contacts.theirs.email],
                        ["工事場所", contacts.theirs.address],
                        ["連絡のつきやすい時間", contacts.theirs.hours],
                      ] as const
                    )
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-3 py-2">
                          <dt className="text-muted">{k}</dt>
                          <dd className="min-w-0 break-words">{v}</dd>
                        </div>
                      ))}
                  </dl>
                ) : (
                  <p className="mt-2 text-[14px] text-muted">まだ登録されていません。登録されるとお知らせします。</p>
                )}
              </div>
              <div className="mt-6">
                <div className="mb-3 text-[14px] font-medium text-ink-2">あなたの連絡先</div>
                <ContactForm contractId={c.id} side={viewer} initial={contacts.mine} />
              </div>
            </div>
          )}

          <div>
            {stage === "contracted" && c.status === "contracted" && <AdvanceContractButton contractId={c.id} to="in_progress" label="工事が始まった" />}
            {c.status === "in_progress" && <AdvanceContractButton contractId={c.id} to="completed" label="工事が終わった" variant="primary" />}
          </div>
        </div>
      )}

      {viewer === "company" && !locked && (
        <div className="mt-8">
          <h3 className="mb-4 text-[17px] font-medium">{terms ? "契約条件を変更する" : "契約条件を入力する"}</h3>
          <TermsForm contractId={c.id} initial={initial} hasTerms={!!terms} />
          <Link href={`/business/quotes/new?match=${c.match_id}`} className="mt-4 flex min-h-11 items-center justify-center text-[15px] text-muted underline-offset-4 hover:text-ink hover:underline">
            金額を変える場合は見積を改訂する
          </Link>
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
