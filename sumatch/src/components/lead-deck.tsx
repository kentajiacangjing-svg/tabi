"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { respondLeadAction } from "@/app/actions/chat";
import { Button, cx } from "./ui";

export interface DeckLead {
  projectId: string;
  city: string;
  category: string;
  houseType: string;
  budget: string;
  timing: string;
  photos: number;
  photo: string | null;
  details: string;
  customerWants: boolean;
  received: string;
}

/** Companies judge one consultation at a time, like the customer does. */
function BigFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-line p-6 odd:border-r [&:nth-child(n+3)]:border-b-0">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="jp mt-1 text-[22px] font-medium leading-snug">{value}</dd>
    </div>
  );
}

export function LeadDeck({ leads, blockedReason }: { leads: DeckLead[]; blockedReason?: string }) {
  const router = useRouter();
  const [queue, setQueue] = useState(leads);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [pending, start] = useTransition();
  const current = queue[0];

  const respond = (yes: boolean) =>
    current &&
    start(async () => {
      setError(null);
      const r = await respondLeadAction(current.projectId, yes);
      if (!r.ok) return setError(r.error);
      if (r.status === "matched") return router.push(`/business/match/${r.matchId}`);
      setLeaving(true);
      setTimeout(() => {
        setQueue((q) => q.slice(1));
        setLeaving(false);
        setNote(yes ? `${current.city}の相談に「対応したい」を送りました。お客様が選ぶとメッセージが始まります。` : null);
      }, 160);
    });

  if (!current) {
    return (
      <div className="py-6">
        {note && <p className="mb-8 text-[15px] text-ok">{note}</p>}
        <h2 className="text-[28px] font-semibold">新しい相談はすべて確認しました</h2>
        <p className="mt-3 text-[16px] text-muted">新しい相談が届いたら、メールとブラウザ通知でお知らせします。</p>
        <Link href="/business/active" className="press mt-10 inline-flex h-14 items-center rounded-xl bg-brand px-7 text-white">
          進行中の相談を見る
        </Link>
      </div>
    );
  }

  return (
    <div className={cx("mx-auto max-w-[540px] transition-[opacity,transform] duration-200", leaving && "translate-x-[-8%] opacity-0")}>
      <div className="mb-3 flex justify-between text-[14px] text-muted">
        <span>{leads.length - queue.length + 1} / {leads.length}件目</span>
        <span>{current.received}に届きました</span>
      </div>
      <article key={current.projectId} className="animate-fade-up overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-pop)]">
        {current.customerWants && <p className="bg-brand-soft px-6 py-3 text-[14px] font-medium text-brand">お客様が相談を希望しています</p>}
        <dl className="grid grid-cols-2">
          <BigFact label="場所" value={current.city} />
          <BigFact label="工事内容" value={current.category} />
          <BigFact label="予算" value={current.budget} />
          <BigFact label="希望時期" value={current.timing} />
        </dl>
        <div className="flex items-center gap-4 border-t border-line px-6 py-4">
          {current.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.photo} alt="お客様の写真" className="size-14 shrink-0 rounded-xl object-cover" />
          )}
          <p className="min-w-0 flex-1 truncate text-[14px] text-muted">{current.details ? `「${current.details}」` : current.photos ? `写真${current.photos}枚` : "詳細はメッセージで確認できます"}</p>
          <Link href={`/business/leads/${current.projectId}`} className="flex min-h-11 shrink-0 items-center text-[15px] text-brand">
            詳しく
          </Link>
        </div>
      </article>

      {(error || blockedReason) && <p className="mt-4 text-[14px] text-danger" role="alert">{error ?? blockedReason}</p>}

      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] mt-4 grid grid-cols-[1fr_1.6fr] gap-3 bg-canvas py-3 md:static">
        <Button variant="secondary" size="lg" disabled={pending} onClick={() => respond(false)}>
          見送る
        </Button>
        <Button size="lg" disabled={pending || (!!blockedReason && current.customerWants)} onClick={() => respond(true)}>
          対応したい
        </Button>
      </div>
    </div>
  );
}
