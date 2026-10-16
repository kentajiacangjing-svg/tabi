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
    <div className={cx("transition-[opacity,transform] duration-150", leaving && "translate-x-[-8%] opacity-0")}>
      <div className="mb-3 flex justify-between text-[14px] text-muted">
        <span>{leads.length - queue.length + 1} / {leads.length}件目</span>
        <span>{current.received}</span>
      </div>
      <article key={current.projectId} className="animate-fade-up">
        {current.photo ? (
          <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.photo} alt="お客様の写真" className="size-full object-cover" />
          </div>
        ) : (
          <div className="grid aspect-[4/3] place-items-center rounded-2xl border border-dashed border-line text-[15px] text-muted">写真はありません</div>
        )}
        {current.customerWants && <p className="mt-5 text-[15px] font-medium text-brand">お客様があなたの会社に相談したいと希望しています</p>}
        <h2 className="mt-5 text-[34px] font-semibold leading-tight">{current.city}</h2>
        <p className="mt-1 text-[20px]">{current.category}</p>
        <dl className="mt-6 border-y border-line text-[16px]">
          <div className="flex justify-between border-b border-line py-3.5"><dt className="text-muted">予算</dt><dd>{current.budget}</dd></div>
          <div className="flex justify-between border-b border-line py-3.5"><dt className="text-muted">希望時期</dt><dd>{current.timing}</dd></div>
          <div className="flex justify-between border-b border-line py-3.5"><dt className="text-muted">お住まい</dt><dd>{current.houseType}</dd></div>
          <div className="flex justify-between py-3.5"><dt className="text-muted">写真</dt><dd>{current.photos}枚</dd></div>
        </dl>
        {current.details && <p className="mt-5 text-[16px] leading-relaxed text-ink-2">「{current.details}」</p>}
        <Link href={`/business/leads/${current.projectId}`} className="mt-3 inline-flex min-h-11 items-center text-[15px] underline underline-offset-4">
          写真と詳細を見る
        </Link>
      </article>

      {(error || blockedReason) && <p className="mt-4 text-[14px] text-danger" role="alert">{error ?? blockedReason}</p>}

      <div className="sticky bottom-[calc(60px+env(safe-area-inset-bottom))] -mx-5 mt-6 grid grid-cols-[1fr_1.6fr] gap-2 border-t border-line bg-canvas px-5 py-3 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
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
