"use client";

import { soft } from "@/lib/soft";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideCompanyAction } from "@/app/actions/customer";
import { Button, Notice } from "./ui";

/**
 * 依頼先決定 — choosing the company is not a contract. The amount and version are shown, not editable: the
 * server takes them from the latest quote. The terms are prepared afterwards by the company and agreed by both.
 */
export function DecideButton({
  matchId,
  quoteId,
  companyName,
  amount,
  version,
  variant = "primary",
  label = "この会社に依頼先を決める",
}: {
  matchId: string;
  quoteId: string;
  companyName: string;
  amount: number;
  version: number;
  variant?: "primary" | "secondary";
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const sent = useRef(false);
  const decide = () => {
    if (sent.current) return;
    sent.current = true;
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("match_id", matchId);
      fd.set("quote_id", quoteId);
      const r = await soft(decideCompanyAction(fd));
      if (!r.ok) {
        sent.current = false;
        return setError(r.error);
      }
      router.push(`/projects/${r.projectId}?decided=1#contract`);
      router.refresh();
    });
  };
  return (
    <>
      <Button variant={variant} size="lg" className="w-full" onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && (
        <div className="animate-zoom fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 pb-[max(env(safe-area-inset-bottom),12px)] sm:items-center" onClick={() => !pending && setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="decide-title"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[calc(100dvh-24px)] w-full max-w-md space-y-5 overflow-y-auto rounded-[24px] bg-surface p-6"
          >
            <div>
              <div id="decide-title" className="text-[22px] font-semibold">
                {companyName}を依頼先に決めますか？
              </div>
              <div className="mt-4 rounded-2xl bg-soft px-4 py-3">
                <div className="text-[13px] text-muted">見積 第{version}版（税込）</div>
                <div className="mt-0.5 text-[26px] font-medium tabular-nums">¥{amount.toLocaleString("ja-JP")}</div>
              </div>
            </div>
            <ul className="space-y-2 text-[15px] leading-relaxed text-ink-2">
              <li>・この時点では契約は成立しません。</li>
              <li>・次に、{companyName}が工事範囲・日程・支払条件・保証などの契約条件を用意します。</li>
              <li>・お客様と会社の双方が同じ条件に同意したときに「双方の合意確認済み」になります。</li>
              <li>・他の会社には「今回は別の会社に依頼する」旨をSUMATCHからお伝えします。</li>
            </ul>
            {error && <Notice tone="danger">{error}</Notice>}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)} disabled={pending}>
                やめる
              </Button>
              <Button type="button" className="flex-1" onClick={decide} disabled={pending}>
                {pending ? "記録中…" : "依頼先に決める"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
