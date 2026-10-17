"use client";

import { soft } from "@/lib/soft";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideCompanyAction } from "@/app/actions/customer";
import { Button, Field, Input, Notice, Textarea } from "./ui";

export function DecideButton({
  matchId,
  quoteId,
  companyName,
  amount,
  variant = "primary",
  label = "この会社に決める",
}: {
  matchId: string;
  quoteId: string | null;
  companyName: string;
  amount: number | null;
  variant?: "primary" | "secondary";
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <Button variant={variant} size="lg" className="w-full" onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && (
        <div className="animate-zoom fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 pb-[max(env(safe-area-inset-bottom),12px)] sm:items-center" onClick={() => setOpen(false)}>
          <form
            onClick={(e) => e.stopPropagation()}
            action={(fd) =>
              start(async () => {
                const r = await soft(decideCompanyAction(fd));
                if (!r.ok) return setError(r.error);
                router.push(`/projects/${r.projectId}?decided=1`);
                router.refresh();
              })
            }
            className="max-h-[calc(100dvh-24px)] w-full max-w-md space-y-5 overflow-y-auto rounded-[24px] bg-surface p-6"
          >
            <div>
              
              <div className="text-[24px] font-semibold">{companyName}に決める</div>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">決定内容は相談に記録され、他の会社には「今回は別の会社に依頼する」旨をSUMATCHからお伝えします。</p>
            </div>
            <input type="hidden" name="match_id" value={matchId} />
            <input type="hidden" name="quote_id" value={quoteId ?? ""} />
            <Field label="契約予定金額（税込・円）" required>
              <Input name="amount" type="number" inputMode="numeric" defaultValue={amount ?? ""} min={1} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="契約日">
                <Input name="contract_date" type="date" defaultValue={today} />
              </Field>
              <Field label="工事予定日">
                <Input name="start_date" type="date" />
              </Field>
            </div>
            <Field label="契約書（任意）" hint="PDFまたは画像。あとから追加もできます。">
              <Input name="contract_file" type="file" accept="application/pdf,image/*" className="py-2.5 text-sm" />
            </Field>
            <Field label="メモ（任意）">
              <Textarea name="notes" rows={2} />
            </Field>
            {error && <Notice tone="danger">{error}</Notice>}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                キャンセル
              </Button>
              <Button className="flex-1" disabled={pending}>
                {pending ? "記録中…" : "決定する"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
