"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { respondLeadAction } from "@/app/actions/chat";
import { Button, cx } from "./ui";
import { Icon } from "./icons";

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
    <div className="border-b border-line p-5 odd:border-r sm:p-6 [&:nth-child(n+3)]:border-b-0">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="jp tnum mt-1 text-[22px] font-semibold leading-snug sm:text-[24px]">{value}</dd>
    </div>
  );
}

/** `withRest` also lists the waiting consultations compactly (business home). */
export function LeadDeck({ leads, blockedReason, withRest }: { leads: DeckLead[]; blockedReason?: string; withRest?: boolean }) {
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
      <div className="rounded-[24px] bg-surface p-7 shadow-[var(--shadow-card)] sm:p-9">
        {note && <p className="mb-6 text-[15px] text-ok">{note}</p>}
        <span className="mb-5 grid size-12 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
          <Icon name="check" size={22} strokeWidth={2.2} />
        </span>
        <h2 className="text-[28px] font-bold">新しい相談はすべて確認しました</h2>
        <p className="mt-3 text-[16px] text-muted">新しい相談が届いたら、メールとブラウザ通知でお知らせします。</p>
        <Link href="/business/active" className="press mt-10 inline-flex h-14 items-center rounded-2xl bg-brand px-7 font-medium text-white hover:bg-brand-2">
          進行中の相談を見る
        </Link>
      </div>
    );
  }

  const rest = queue.slice(1);

  return (
    <div className={cx(withRest && "grid items-start gap-10 lg:grid-cols-[540px_minmax(0,1fr)]")}>
    <div className={cx("mx-auto w-full max-w-[540px] transition-[opacity,transform] duration-200 lg:mx-0", !withRest && "lg:mx-auto", leaving && "translate-x-[-8%] opacity-0")}>
      <div className="mb-3 flex justify-between text-[13px] text-muted">
        <span className="tnum">
          <span className="font-semibold text-ink">{leads.length - queue.length + 1}</span> / {leads.length}件目
        </span>
        <span>{current.received}に届きました</span>
      </div>
      <article key={current.projectId} className="animate-fade-up overflow-hidden rounded-[28px] bg-surface shadow-[var(--shadow-deck)]">
        {current.photo && (
          <div className="relative h-36 bg-soft sm:h-44">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.photo} alt="お客様の写真" className="size-full object-cover" />
            <div className="scrim-b absolute inset-0" />
            {current.photos > 1 && <span className="absolute bottom-3 right-4 text-[12px] text-white/90">写真{current.photos}枚</span>}
          </div>
        )}
        {current.customerWants && (
          <p className="flex items-center gap-2 bg-brand-soft px-6 py-3 text-[14px] font-semibold text-brand">
            <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
            お客様が相談を希望しています
          </p>
        )}
        <dl className="grid grid-cols-2">
          <BigFact label="場所" value={current.city} />
          <BigFact label="工事内容" value={current.category} />
          <BigFact label="予算" value={current.budget} />
          <BigFact label="希望時期" value={current.timing} />
        </dl>
        <div className="flex items-center gap-4 border-t border-line px-6 py-4">
          <p className="min-w-0 flex-1 truncate text-[14px] text-muted">{current.details ? `「${current.details}」` : "詳細はメッセージで確認できます"}</p>
          <Link href={`/business/leads/${current.projectId}`} className="flex min-h-11 shrink-0 items-center gap-0.5 text-[14px] font-medium text-brand">
            詳しく
          </Link>
        </div>
      </article>

      {(error || blockedReason) && <p className="mt-4 text-[14px] text-danger" role="alert">{error ?? blockedReason}</p>}

      <div className="sticky bottom-[calc(62px+env(safe-area-inset-bottom))] mt-4 grid grid-cols-[1fr_1.6fr] gap-3 bg-canvas/90 py-3 backdrop-blur-md md:static md:bg-transparent md:backdrop-blur-none">
        <button type="button" disabled={pending} onClick={() => respond(false)} className="press h-14 rounded-[18px] bg-[#e9ebe6] text-[16px] font-medium text-ink-2 hover:bg-[#e2e4de] disabled:opacity-40">
          見送る
        </button>
        <Button size="lg" className="rounded-[18px]" disabled={pending || (!!blockedReason && current.customerWants)} onClick={() => respond(true)}>
          対応したい
        </Button>
      </div>
    </div>

    {withRest && rest.length === 0 && (
      <div className="hidden rounded-[22px] bg-brand-soft p-6 lg:mt-8 lg:block">
        <div className="text-[16px] font-semibold text-brand-ink">ほかの新しい相談はありません</div>
        <p className="mt-1 text-[14px] text-muted">届いたらメールとブラウザ通知でお知らせします。</p>
        <Link href="/business/active" className="mt-4 inline-flex min-h-11 items-center text-[14px] font-medium text-brand">
          進行中の案件を見る
        </Link>
      </div>
    )}
    {withRest && rest.length > 0 && (
      <div className="lg:pt-8">
        <div className="mb-3 text-[14px] font-semibold text-ink-2">ほかの相談 {rest.length}件</div>
        <ul className="overflow-hidden rounded-[22px] bg-surface shadow-[var(--shadow-card)]">
          {rest.map((l) => (
            <li key={l.projectId} className="border-b border-line last:border-0">
              <Link href={`/business/leads/${l.projectId}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-canvas">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[15px] font-semibold">
                    {l.customerWants && <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-label="お客様が希望" />}
                    <span className="truncate">
                      {l.city}・{l.category}
                    </span>
                  </span>
                  <span className="tnum mt-0.5 block truncate text-[13px] text-muted">
                    {l.budget}・{l.timing}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] text-faint">{l.received}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    )}
    </div>
  );
}
