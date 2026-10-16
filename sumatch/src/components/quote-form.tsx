"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitQuoteAction } from "@/app/actions/chat";
import { TAX_RATE } from "@/lib/constants";
import { Icon } from "./icons";
import { Button, Field, Input, Notice, Textarea, inputClass, cx } from "./ui";

interface Item {
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

export interface QuoteDefaults {
  title: string;
  items: Item[];
  overhead: number;
  discount: number;
  warranty: string;
  warranty_years: number;
  duration: string;
  duration_days: number | null;
  materials: string;
  payment_terms: string;
  extra_costs: string;
  notes: string;
}

const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;

export function QuoteForm({ matchId, defaults, revision }: { matchId: string; defaults: QuoteDefaults; revision: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(defaults.items.length ? defaults.items : [{ name: "", quantity: 1, unit: "式", unit_price: 0 }]);
  const [overhead, setOverhead] = useState(defaults.overhead);
  const [discount, setDiscount] = useState(defaults.discount);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const subtotal = items.reduce((a, i) => a + Math.round((i.quantity || 0) * (i.unit_price || 0)), 0);
  const taxable = Math.max(0, subtotal + (overhead || 0) - (discount || 0));
  const tax = Math.round(taxable * TAX_RATE);
  const total = taxable + tax;

  const upd = (idx: number, patch: Partial<Item>) => setItems((xs) => xs.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  return (
    <form
      action={(fd) =>
        start(async () => {
          setError(null);
          fd.set("items", JSON.stringify(items.filter((i) => i.name.trim())));
          fd.set("match_id", matchId);
          const r = await submitQuoteAction(fd);
          if (!r.ok) return setError(r.error);
          router.push(`/business/messages/${r.matchId}`);
          router.refresh();
        })
      }
      className="space-y-6"
    >
      <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
        <Field label="件名" required>
          <Input name="title" defaultValue={defaults.title} required maxLength={120} />
        </Field>

        <div className="mt-6">
          <div className="mb-2 text-[13px] font-semibold text-ink-2">工事項目</div>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-2xl bg-soft p-3 sm:grid-cols-[1fr_5rem_4rem_7.5rem_7rem_auto] sm:items-center sm:bg-transparent sm:p-0">
                <input className={cx(inputClass, "col-span-2 py-2.5 sm:col-span-1")} placeholder="工事項目（例: 足場架設）" value={it.name} onChange={(e) => upd(i, { name: e.target.value })} aria-label="工事項目" />
                <div className="col-span-2 grid grid-cols-[1fr_1fr_1.6fr] gap-2 sm:contents">
                  <input className={cx(inputClass, "py-2.5 text-right")} type="number" step="any" min={0} value={it.quantity} onChange={(e) => upd(i, { quantity: Number(e.target.value) })} aria-label="数量" />
                  <input className={cx(inputClass, "py-2.5")} value={it.unit} onChange={(e) => upd(i, { unit: e.target.value })} aria-label="単位" maxLength={10} />
                  <input className={cx(inputClass, "py-2.5 text-right")} type="number" min={0} value={it.unit_price} onChange={(e) => upd(i, { unit_price: Number(e.target.value) })} aria-label="単価" />
                </div>
                <div className="text-right text-sm font-semibold tabular-nums sm:pr-1">{yen(it.quantity * it.unit_price)}</div>
                <button type="button" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} className="grid size-9 place-items-center justify-self-end rounded-full text-muted hover:bg-line-2" aria-label="項目を削除">
                  <Icon name="x" size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 hidden grid-cols-[1fr_5rem_4rem_7.5rem_7rem_auto] gap-2 px-1 text-[11px] text-faint sm:grid">
            <span>項目</span>
            <span className="text-right">数量</span>
            <span>単位</span>
            <span className="text-right">単価</span>
            <span className="text-right">小計</span>
            <span className="w-9" />
          </div>
          <button type="button" onClick={() => setItems((xs) => [...xs, { name: "", quantity: 1, unit: "式", unit_price: 0 }])} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
            <Icon name="plus" size={16} />
            項目を追加
          </button>
        </div>

        <div className="mt-6 grid gap-3 border-t border-line pt-5 sm:ml-auto sm:max-w-sm">
          <Line label="工事費小計" value={yen(subtotal)} />
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">諸経費</span>
            <input name="overhead" type="number" min={0} value={overhead} onChange={(e) => setOverhead(Number(e.target.value))} className={cx(inputClass, "w-36 py-2 text-right")} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">値引き</span>
            <input name="discount" type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className={cx(inputClass, "w-36 py-2 text-right")} />
          </label>
          <Line label={`消費税（${TAX_RATE * 100}%）`} value={yen(tax)} />
          <div className="flex items-baseline justify-between border-t border-line pt-3">
            <span className="font-bold">合計（税込）</span>
            <span className="text-2xl font-extrabold tracking-tight">{yen(total)}</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-3xl border border-line bg-white p-5 sm:grid-cols-2 sm:p-6">
        <Field label="保証内容">
          <Input name="warranty" defaultValue={defaults.warranty} placeholder="外壁10年保証（自社）" />
        </Field>
        <Field label="保証年数" hint="比較表で使います">
          <Input name="warranty_years" type="number" min={0} max={50} step="0.5" defaultValue={defaults.warranty_years} />
        </Field>
        <Field label="工期">
          <Input name="duration" defaultValue={defaults.duration} placeholder="約14日（天候により前後）" />
        </Field>
        <Field label="工期（日数）" hint="比較表で使います">
          <Input name="duration_days" type="number" min={0} defaultValue={defaults.duration_days ?? ""} />
        </Field>
        <Field label="材料・商品">
          <Input name="materials" defaultValue={defaults.materials} />
        </Field>
        <Field label="支払条件">
          <Input name="payment_terms" defaultValue={defaults.payment_terms} placeholder="着工時30%・完工時70%" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="追加費用について" hint="発生しうる追加費用の条件を書いておくと、お客様の比較画面で安心材料になります">
            <Textarea name="extra_costs" rows={2} defaultValue={defaults.extra_costs} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="備考・注意事項">
            <Textarea name="notes" rows={3} defaultValue={defaults.notes} />
          </Field>
        </div>
        <Field label="有効期限">
          <Input name="valid_until" type="date" defaultValue={new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10)} />
        </Field>
        <Field label="見積書PDF（任意）" hint="自社書式の見積書があれば添付できます">
          <Input name="pdf" type="file" accept="application/pdf" className="py-2.5 text-sm" />
        </Field>
      </section>

      {error && <Notice tone="danger" icon="alert">{error}</Notice>}
      <div className="sticky bottom-20 z-10 flex items-center justify-between gap-3 rounded-3xl border border-line bg-white/95 p-3 pl-5 shadow-[var(--shadow-pop)] backdrop-blur md:bottom-4">
        <div>
          <div className="text-[11px] text-muted">合計（税込）</div>
          <div className="text-lg font-bold">{yen(total)}</div>
        </div>
        <Button size="lg" disabled={pending || total <= 0}>
          {pending ? "提出中…" : revision ? "改訂版を提出" : "見積もりを提出"}
        </Button>
      </div>
    </form>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
