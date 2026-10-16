"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { markCompanyAction, requestMatchAction, trackCompanyViewAction } from "@/app/actions/customer";
import { Button, cx } from "./ui";

export interface DeckCompany {
  matchId: string;
  companyId: string;
  name: string;
  city: string;
  category: string;
  rating: number;
  reviews: number;
  works: number;
  tagline: string;
  reasons: string[];
  photo: string | null;
  photoCaption: string | null;
  wantsYou: boolean;
}

/** One company at a time. Buttons always work; a horizontal swipe is a shortcut (left = 見送る, right = 保存). */
export function CompanyDeck({ projectId, deck, canConsult, consultLeft }: { projectId: string; deck: DeckCompany[]; canConsult: boolean; consultLeft: number }) {
  const router = useRouter();
  const [queue, setQueue] = useState(deck);
  const [left, setLeft] = useState(consultLeft);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const [dx, setDx] = useState(0);
  const [pending, start] = useTransition();
  const startX = useRef<number | null>(null);
  const current = queue[0];

  useEffect(() => {
    if (current) trackCompanyViewAction(current.matchId).catch(() => {});
  }, [current]);

  const advance = (dir: "left" | "right", msg?: string) => {
    setLeaving(dir);
    setTimeout(() => {
      setQueue((q) => q.slice(1));
      setLeaving(null);
      setDx(0);
      setNote(msg ?? null);
    }, 180);
  };

  const act = (kind: "pass" | "save" | "consult") => {
    if (!current || pending) return;
    setError(null);
    start(async () => {
      if (kind === "consult") {
        const r = await requestMatchAction(current.matchId);
        if (!r.ok) return setError(r.error);
        if (r.status === "matched") {
          router.push(`/match/${r.matchId}`);
          return;
        }
        setLeft((n) => n - 1);
        advance("right", `${current.name}に相談を送りました。返事が来たらお知らせします。`);
      } else {
        const r = await markCompanyAction(current.matchId, kind);
        if (!r.ok) return setError(r.error);
        advance(kind === "pass" ? "left" : "right", kind === "save" ? `${current.name}を保存しました。` : undefined);
      }
    });
  };

  if (!current) {
    return (
      <div className="animate-fade-up py-10">
        {note && <p className="mb-8 text-[15px] text-ok">{note}</p>}
        <h2 className="text-[28px] font-semibold leading-snug">いまご紹介できる会社は以上です</h2>
        <p className="mt-3 text-[16px] leading-relaxed text-muted">相談した会社から返事が来たら、お知らせします。新しく合う会社が見つかった時もお伝えします。</p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href={`/projects/${projectId}`} className="press inline-flex h-14 items-center justify-center rounded-xl bg-brand px-7 text-white">
            相談の状況を見る
          </Link>
          <Link href="/saved" className="inline-flex h-14 items-center justify-center px-4 text-[15px] text-muted underline-offset-4 hover:text-ink hover:underline">
            保存した会社
          </Link>
        </div>
      </div>
    );
  }

  const swipeStyle = leaving
    ? { transform: `translateX(${leaving === "left" ? -120 : 120}%) rotate(${leaving === "left" ? -4 : 4}deg)`, opacity: 0, transition: "transform .18s ease-in, opacity .18s ease-in" }
    : { transform: dx ? `translateX(${dx}px) rotate(${dx / 40}deg)` : undefined, transition: dx ? "none" : "transform .2s ease" };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-[14px] text-muted">
        <span>{deck.length - queue.length + 1} / {deck.length}社目</span>
        <span>{canConsult ? `あと${left}社まで相談できます` : "相談できるのは3社までです"}</span>
      </div>

      <article
        key={current.matchId}
        className="animate-fade-up touch-pan-y select-none"
        style={swipeStyle}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") return;
          startX.current = e.clientX;
        }}
        onPointerMove={(e) => startX.current != null && setDx(e.clientX - startX.current)}
        onPointerUp={() => {
          const d = dx;
          startX.current = null;
          if (d < -110) act("pass");
          else if (d > 110) act("save");
          else setDx(0);
        }}
        onPointerCancel={() => {
          startX.current = null;
          setDx(0);
        }}
        aria-label={`${current.name}の紹介`}
      >
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-soft sm:aspect-[16/11]">
          {current.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.photo} alt={`${current.name}の施工写真`} className="size-full object-cover" draggable={false} />
          )}
          {current.photo && current.photoCaption && (
            <span className="absolute bottom-0 left-0 right-0 bg-ink/55 px-4 py-2.5 text-[13px] text-white">施工事例：{current.photoCaption}</span>
          )}
          {current.wantsYou && (
            <span className="absolute left-4 top-4 rounded-md bg-surface/95 px-3 py-1.5 text-[13px] text-ink">この会社もあなたの相談に対応したいと考えています</span>
          )}
        </div>
        <div className="pt-6">
          <h2 className="text-[28px] font-semibold leading-tight">{current.name}</h2>
          <p className="mt-1 text-[16px] text-ink-2">
            {current.city} / {current.category}
          </p>
          <p className="mt-2 text-[15px] text-ink-2">
            <span aria-hidden="true">★ </span>
            {current.rating.toFixed(1)}
            <span className="text-muted">（口コミ{current.reviews}件）</span>
            <span className="mx-2 text-line">|</span>施工実績 {current.works.toLocaleString()}件
          </p>
          <p className="mt-5 text-[17px] leading-relaxed">「{current.tagline}」</p>
          {current.reasons.length > 0 && <p className="mt-4 text-[14px] leading-relaxed text-muted">ご紹介の理由：{current.reasons.join("・")}</p>}
          <Link href={`/company/${current.companyId}?project=${projectId}`} className="mt-4 inline-flex min-h-11 items-center text-[15px] text-ink underline underline-offset-4">
            施工事例と口コミを見る
          </Link>
        </div>
      </article>

      {(note || error) && <p className={cx("mt-4 text-[14px]", error ? "text-danger" : "text-ok")} role="status">{error ?? note}</p>}

      <div className="sticky bottom-[calc(60px+env(safe-area-inset-bottom))] -mx-5 mt-6 grid grid-cols-[1fr_1fr_1.6fr] gap-2 border-t border-line bg-canvas px-5 py-3 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
        <Button variant="secondary" size="lg" disabled={pending} onClick={() => act("pass")}>
          見送る
        </Button>
        <Button variant="secondary" size="lg" disabled={pending} onClick={() => act("save")}>
          保存
        </Button>
        <Button size="lg" disabled={pending || !canConsult || left <= 0} onClick={() => act("consult")}>
          相談する
        </Button>
      </div>
    </div>
  );
}
