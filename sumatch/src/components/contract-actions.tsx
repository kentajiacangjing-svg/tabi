"use client";

import { soft } from "@/lib/soft";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { agreeTermsAction, saveTermsAction, uploadContractFileAction } from "@/app/actions/contract";
import { TERM_FIELDS, type TermKey } from "@/lib/contract-terms";
import { Button, Field, Input, Notice, Textarea } from "./ui";

/** Agree to the exact terms on screen. The hash tells the server which version that was. */
export function AgreeButton({ contractId, termsHash, label = "この条件に同意する" }: { contractId: string; termsHash: string; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const sent = useRef(false);
  return (
    <div className="space-y-3">
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px] leading-relaxed">
        <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--color-brand)]" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        <span>上の契約条件をすべて確認しました。</span>
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
            const r = await soft(agreeTermsAction(contractId, termsHash));
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

export function ContractFileForm({ contractId }: { contractId: string }) {
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
      <Field label="契約書（PDFまたは画像）" hint="御社で作成した工事請負契約書を添付すると、お客様もここから開けます。">
        <Input name="contract_file" type="file" accept="application/pdf,image/*" className="py-2.5 text-sm" required />
      </Field>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button variant="secondary" disabled={pending}>
        {pending ? "アップロード中…" : "契約書を添付する"}
      </Button>
    </form>
  );
}
