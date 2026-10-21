"use client";

import { soft } from "@/lib/soft";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { agreeTermsAction, confirmContractDocumentAction, saveContractContactAction, saveTermsAction, uploadContractFileAction } from "@/app/actions/contract";
import { TERM_FIELDS, type TermKey } from "@/lib/contract-terms";
import { Button, Field, Input, Notice, Textarea } from "./ui";

/** Agree to the exact terms on screen. The hash tells the server which version that was. */
export function AgreeButton({
  contractId,
  termsHash,
  label = "この条件に同意する",
  checkLabel = "上の契約条件をすべて確認しました。",
  kind = "terms",
}: {
  contractId: string;
  termsHash: string;
  label?: string;
  checkLabel?: string;
  /** terms: agree to the contract terms / document: confirm the registered contract document */
  kind?: "terms" | "document";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const sent = useRef(false);
  return (
    <div className="space-y-3">
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px] leading-relaxed">
        <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--color-brand)]" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        <span>{checkLabel}</span>
      </label>
      <Button
        size="lg"
        className="w-full"
        disabled={!checked || pending}
        onClick={() => {
          if (sent.current) return;
          sent.current = true;
          setError(null);
          start(async () => {
            const r = kind === "document" ? await soft(confirmContractDocumentAction(contractId, termsHash)) : await soft(agreeTermsAction(contractId, termsHash));
            sent.current = false;
            if (!r.ok) setError(r.error);
            router.refresh();
          });
        }}
      >
        {pending ? "記録中…" : label}
      </Button>
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}

/** The company's terms form. Every field is required; the amount is fixed by the quote. */
export function TermsForm({ contractId, initial, hasTerms }: { contractId: string; initial: Record<TermKey, string>; hasTerms: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="space-y-5"
      onChange={() => setSaved(false)}
      action={(fd) =>
        start(async () => {
          setError(null);
          const r = await soft(saveTermsAction(contractId, fd));
          if (!r.ok) return setError(r.error);
          setSaved(true);
          router.refresh();
        })
      }
    >
      {TERM_FIELDS.map((f) => (
        <Field key={f.key} label={f.label} hint={f.hint} required>
          {f.multiline ? (
            <Textarea name={f.key} rows={3} defaultValue={initial[f.key]} required maxLength={1000} />
          ) : (
            <Input name={f.key} type={f.type ?? "text"} defaultValue={initial[f.key]} required maxLength={200} />
          )}
        </Field>
      ))}
      {hasTerms && <p className="text-[14px] text-muted">条件を変更すると、お客様と御社の同意はいったん取り消され、もう一度確認していただくことになります。</p>}
      {error && <Notice tone="danger">{error}</Notice>}
      {saved && !error && <Notice tone="ok">契約条件を保存し、お客様にお知らせしました。</Notice>}
      <Button size="lg" className="w-full" disabled={pending}>
        {pending ? "保存中…" : hasTerms ? "条件を更新してお客様に送る" : "この条件をお客様に送る"}
      </Button>
    </form>
  );
}

export function ContractFileForm({ contractId, replacing = false }: { contractId: string; replacing?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      action={(fd) =>
        start(async () => {
          setError(null);
          const r = await soft(uploadContractFileAction(contractId, fd));
          if (!r.ok) return setError(r.error);
          router.refresh();
        })
      }
    >
      <Field label="契約書（PDFまたは画像）" hint="御社で作成した工事請負契約書を登録してください。お客様と御社の双方が内容を確認すると、契約成立の要件がそろいます。">
        <Input name="contract_file" type="file" accept="application/pdf,image/*" className="py-2.5 text-sm" required />
      </Field>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button variant="secondary" disabled={pending}>
        {pending ? "アップロード中…" : replacing ? "契約書を差し替える（確認はやり直し）" : "契約書を登録する"}
      </Button>
    </form>
  );
}

/** Each side's own contact details, after 契約成立. Only what the work needs. */
export function ContactForm({
  contractId,
  side,
  initial,
}: {
  contractId: string;
  side: "customer" | "company";
  initial: { name: string; phone: string; email: string; address: string; hours: string } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="space-y-4"
      onChange={() => setSaved(false)}
      action={(fd) =>
        start(async () => {
          setError(null);
          const r = await soft(saveContractContactAction(contractId, fd));
          if (!r.ok) return setError(r.error);
          setSaved(true);
          router.refresh();
        })
      }
    >
      <Field label={side === "company" ? "担当者名" : "お名前"} required>
        <Input name="name" defaultValue={initial?.name ?? ""} required maxLength={60} autoComplete="name" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="電話番号" hint="電話番号かメールのどちらかは必須です">
          <Input name="phone" type="tel" inputMode="tel" defaultValue={initial?.phone ?? ""} maxLength={30} autoComplete="tel" />
        </Field>
        <Field label="メールアドレス">
          <Input name="email" type="email" defaultValue={initial?.email ?? ""} maxLength={120} autoComplete="email" />
        </Field>
      </div>
      {side === "customer" && (
        <Field label="工事場所の住所" hint="現地での工事に必要な場合だけ入力してください">
          <Input name="address" defaultValue={initial?.address ?? ""} maxLength={200} autoComplete="street-address" />
        </Field>
      )}
      <Field label="連絡のつきやすい時間帯">
        <Input name="hours" defaultValue={initial?.hours ?? ""} maxLength={100} placeholder="例：平日 18時以降" />
      </Field>
      {error && <Notice tone="danger">{error}</Notice>}
      {saved && !error && <Notice tone="ok">連絡先を保存しました。相手にお知らせしました。</Notice>}
      <Button variant="secondary" disabled={pending}>
        {pending ? "保存中…" : initial ? "連絡先を更新する" : "連絡先を登録する"}
      </Button>
    </form>
  );
}
