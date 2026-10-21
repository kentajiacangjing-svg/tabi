"use client";

import { soft } from "@/lib/soft";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveVisitAction, closeVisitAction, proposeVisitAction } from "@/app/actions/visit";
import { Button, Field, Input, Notice, Textarea } from "./ui";

const fmt = (iso: string) => new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });

/** The company proposes up to three dates. Times are entered in the browser's local time and sent as ISO. */
export function ProposeVisitForm({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      action={(fd) =>
        start(async () => {
          setError(null);
          const out = new FormData();
          for (const v of fd.getAll("slot_local")) if (String(v)) out.append("slot", new Date(String(v)).toISOString());
          out.set("note", String(fd.get("note") ?? ""));
          const r = await soft(proposeVisitAction(matchId, out));
          if (!r.ok) return setError(r.error);
          router.refresh();
        })
      }
    >
      {[1, 2, 3].map((i) => (
        <Field key={i} label={`候補日時 ${i}`} required={i === 1}>
          <Input name="slot_local" type="datetime-local" required={i === 1} />
        </Field>
      ))}
      <Field label="メモ（任意）" hint="所要時間・確認したい場所など。連絡先は書けません。">
        <Textarea name="note" rows={2} maxLength={300} />
      </Field>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button disabled={pending}>{pending ? "送信中…" : "候補日をお客様に送る"}</Button>
    </form>
  );
}

/** The customer picks a date and discloses the address, after reading exactly what is shared, with whom, until when. */
export function ApproveVisitForm({ matchId, visitId, slots, companyName, days }: { matchId: string; visitId: string; slots: string[]; companyName: string; days: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [slot, setSlot] = useState<string>("");
  const [consent, setConsent] = useState(false);
  return (
    <form
      className="space-y-4"
      action={(fd) =>
        start(async () => {
          setError(null);
          fd.set("visit_id", visitId);
          fd.set("slot", slot);
          fd.set("consent", consent ? "yes" : "no");
          const r = await soft(approveVisitAction(matchId, fd));
          if (!r.ok) return setError(r.error);
          router.refresh();
        })
      }
    >
      <fieldset>
        <legend className="mb-2 text-[14px] font-medium text-ink-2">日時を選ぶ</legend>
        <div className="space-y-2">
          {slots.map((s) => (
            <label key={s} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-2 text-[15px] has-[:checked]:border-brand">
              <input type="radio" name="slot_pick" value={s} checked={slot === s} onChange={() => setSlot(s)} className="size-5 accent-[var(--color-brand)]" />
              {fmt(s)}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="訪問先の住所" required hint="この訪問のためだけに、この会社に開示します。">
        <Input name="address" required maxLength={200} autoComplete="street-address" />
      </Field>
      <Field label="訪問時のメモ（任意）" hint="駐車場・建物の入り方など。電話番号などの連絡先は書けません。">
        <Input name="access_note" maxLength={200} />
      </Field>
      <div className="rounded-xl bg-soft px-4 py-3 text-[14px] leading-relaxed">
        <div className="font-medium">開示する内容</div>
        <ul className="mt-1 list-disc pl-5 text-ink-2">
          <li>開示先：{companyName}（の担当者）だけ</li>
          <li>開示する項目：訪問先の住所{`、`}訪問時のメモ（入力した場合）</li>
          <li>日時：{slot ? fmt(slot) : "（上で選んでください）"}</li>
          <li>表示期限：訪問日の{days}日後まで。期限後と取り消し時に消去します</li>
          <li>電話番号・メールアドレスは開示しません</li>
        </ul>
        <p className="mt-2 text-[13px] text-muted">※ この説明文は法務レビュー前の案です。</p>
      </div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px] leading-relaxed">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-5 shrink-0 accent-[var(--color-brand)]" />
        <span>上の内容で、訪問先の住所を{companyName}に開示することに同意します。</span>
      </label>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button size="lg" className="w-full" disabled={pending || !slot || !consent}>
        {pending ? "送信中…" : "この日時で承認し、住所を開示する"}
      </Button>
    </form>
  );
}

export function CloseVisitButton({ matchId, visitId, label }: { matchId: string; visitId: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!confirm(`${label}しますか？開示した住所は消去されます。`)) return;
          start(async () => {
            const r = await soft(closeVisitAction(matchId, visitId));
            if (!r.ok) setError(r.error);
            router.refresh();
          });
        }}
      >
        {label}
      </Button>
      {error && <p className="mt-1 text-[13px] text-danger">{error}</p>}
    </div>
  );
}
