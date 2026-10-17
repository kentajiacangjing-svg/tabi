"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { markCompanyAction, requestMatchAction, trackCompanyViewAction } from "@/app/actions/customer";
import { Icon } from "./icons";
import { cx } from "./ui";

export interface DeckCompany {
  matchId: string;
  companyId: string;
  name: string;
  areas: string;
  priceBand: string;
  specialties: string;
  rating: number;
  reviews: number;
  photo: string | null;
  photoCaption: string | null;
  verified: boolean;
  wantsYou: boolean;
}

type Act = "pass" | "save" | "consult";
const SWIPE = 110;

/**
 * One company at a time. Buttons always work; swipe and keys are shortcuts:
 * left / ← = 興味なし, right / → = 相談したい, ↓ or S = 保存.
 */
export function CompanyDeck({ projectId, deck, consultLeft }: { projectId: string; deck: DeckCompany[]; consultLeft: number }) {
  const router = useRouter();
  const [queue, setQueue] = useState(deck);
  const [left, setLeft] = useState(consultLeft);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Act | null>(null);
  const [dx, setDx] = useState(0);
  const [pending, start] = useTransition();
  const startX = useRef<number | null>(null);
  const current = queue[0];
  const canConsult = left > 0;

  useEffect(() => {
    if (current) trackCompanyViewAction(current.matchId).catch(() => {});
  }, [current]);

  const advance = (kind: Act, msg?: string) => {
    setLeaving(kind);
    setTimeout(() => {
      setQueue((q) => q.slice(1));
      setLeaving(null);
      setDx(0);
      setNote(msg ?? null);
    }, 220);
  };

  const act = useCallback(
    (kind: Act) => {
      if (!current || pending || leaving) return;
      if (kind === "consult" && !canConsult) {
        setDx(0);
        return setError("相談できるのは3社までです。");
      }
      setError(null);
      start(async () => {
        if (kind === "consult") {
          const r = await requestMatchAction(current.matchId);
          if (!r.ok) {
            setDx(0);
            return setError(r.error);
          }
          if (r.status === "matched") return router.push(`/match/${r.matchId}`);
          setLeft((n) => n - 1);
          advance("consult", `${current.name}に相談を送りました`);
        } else {
          const r = await markCompanyAction(current.matchId, kind);
          if (!r.ok) {
            setDx(0);
            return setError(r.error);
          }
          advance(kind, kind === "save" ? `${current.name}を保存しました` : undefined);
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, pending, leaving, canConsult],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === "ArrowLeft") act("pass");
      if (e.key === "ArrowRight") act("consult");
      if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") act("save");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act]);

  if (!current) {
    return (
      <div className="animate-fade-up mx-auto max-w-[520px] py-12 text-center">
        {note && <p className="mb-6 text-[15px] text-brand">{note}</p>}
        <h2 className="text-[26px] font-semibold">今日のご紹介は以上です</h2>
        <p className="mt-3 text-[15px] text-muted">返事が来たらお知らせします。</p>
        <div className="mt-10 grid gap-3">
          <Link href={`/projects/${projectId}`} className="press flex h-14 items-center justify-center rounded-xl bg-brand text-white">
            相談の状況を見る
          </Link>
          <Link href="/saved" className="flex min-h-12 items-center justify-center text-[15px] text-muted hover:text-ink">
            保存した会社
          </Link>
        </div>
      </div>
    );
  }

  const tilt = leaving === "pass" ? -1 : leaving === "consult" ? 1 : 0;
  const style = leaving
    ? leaving === "save"
      ? { transform: "translateY(24px) scale(0.96)", opacity: 0, transition: "transform .22s ease-in, opacity .22s ease-in" }
      : { transform: `translateX(${tilt * 130}%) rotate(${tilt * 6}deg)`, opacity: 0, transition: "transform .22s ease-in, opacity .22s ease-in" }
    : { transform: dx ? `translateX(${dx}px) rotate(${dx / 30}deg)` : undefined, transition: dx ? "none" : "transform .2s ease" };
  const hint = dx > 40 ? "consult" : dx < -40 ? "pass" : null;

  return (
    <div className="mx-auto w-[92vw] max-w-[540px] sm:w-full">
      <div className="mb-3 flex items-center justify-between px-1 text-[13px] text-muted">
        <span>
          {deck.length - queue.length + 1} / {deck.length}
        </span>
        <span>{canConsult ? `あと${left}社まで相談できます` : "相談は3社まで送りました"}</span>
      </div>

      <article
        key={current.matchId}
        className="animate-fade-up relative touch-pan-y select-none overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-pop)]"
        style={style}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          startX.current = e.clientX;
        }}
        onPointerMove={(e) => startX.current != null && setDx(e.clientX - startX.current)}
        onPointerUp={() => {
          const d = dx;
          startX.current = null;
          if (d < -SWIPE) act("pass");
          else if (d > SWIPE) act("consult");
          else setDx(0);
        }}
        onPointerCancel={() => {
          startX.current = null;
          setDx(0);
        }}
        aria-label={`${current.name}`}
      >
        <div className="relative aspect-[4/3.4] bg-soft sm:aspect-[16/10]">
          {current.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.photo} alt={current.photoCaption ? `施工事例：${current.photoCaption}` : `${current.name}の施工写真`} className="size-full object-cover" draggable={false} />
          )}
          {current.photoCaption && (
            <span className="absolute bottom-4 left-4 max-w-[calc(100%-2rem)] truncate rounded-lg bg-ink/60 px-2.5 py-1 text-[12px] text-white">施工事例：{current.photoCaption}</span>
          )}
          {current.wantsYou && <span className="absolute left-4 top-4 rounded-xl bg-surface/95 px-3 py-1.5 text-[13px] text-ink">この会社も対応を希望しています</span>}
          {hint && (
            <span
              className={cx(
                "absolute top-5 rounded-xl border-2 px-3 py-1 text-[15px] font-semibold",
                hint === "consult" ? "right-5 border-brand bg-surface/90 text-brand" : "left-5 border-ink bg-surface/90 text-ink",
              )}
            >
              {hint === "consult" ? "相談したい" : "興味なし"}
            </span>
          )}
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="jp text-[24px] font-semibold leading-tight">{current.name}</h2>
            <span className="shrink-0 pt-1 text-[15px]">
              ★ {current.rating.toFixed(1)}
              <span className="text-muted">（{current.reviews}）</span>
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-[4.5rem_1fr] gap-y-1.5 text-[15px]">
            <dt className="text-muted">エリア</dt>
            <dd className="truncate">{current.areas}</dd>
            <dt className="text-muted">価格帯</dt>
            <dd>{current.priceBand}</dd>
            <dt className="text-muted">得意</dt>
            <dd className="truncate">{current.specialties}</dd>
          </dl>
          <div className="mt-4 flex items-center justify-between">
            {current.verified ? <span className="text-[13px] text-muted">✓ 会社確認済み</span> : <span />}
            <Link href={`/company/${current.companyId}?project=${projectId}`} className="flex min-h-11 items-center text-[15px] font-medium text-brand">
              詳しく見る
            </Link>
          </div>
        </div>
      </article>

      <p className={cx("mt-3 min-h-6 text-center text-[14px]", error ? "text-danger" : "text-brand")} role="status">
        {error ?? note ?? ""}
      </p>

      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] mt-1 grid grid-cols-3 gap-3 bg-canvas py-3 md:static">
        <DeckButton label="興味なし" glyph="×" onClick={() => act("pass")} disabled={pending} />
        <DeckButton label="保存" glyph="♡" onClick={() => act("save")} disabled={pending} />
        <DeckButton label="相談したい" glyph="✓" primary onClick={() => act("consult")} disabled={pending || !canConsult} />
      </div>
      <p className="mt-1 hidden text-center text-[12px] text-faint md:block">キーボード：← 興味なし　→ 相談したい　S 保存</p>
    </div>
  );
}

function DeckButton({ label, glyph, onClick, disabled, primary }: { label: string; glyph: string; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "press flex h-[68px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[14px] font-medium disabled:opacity-40",
        primary ? "bg-brand text-white" : "border border-line bg-surface text-ink shadow-[var(--shadow-card)]",
      )}
    >
      <span className="text-[22px] leading-none" aria-hidden="true">
        {glyph}
      </span>
      {label}
    </button>
  );
}
