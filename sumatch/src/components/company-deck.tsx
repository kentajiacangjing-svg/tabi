"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { markCompanyAction, requestMatchAction, trackCompanyViewAction } from "@/app/actions/customer";
import { Icon } from "./icons";
import { Kicker, cx } from "./ui";

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
export function CompanyDeck({ projectId, deck, consultLeft, conditions }: { projectId: string; deck: DeckCompany[]; consultLeft: number; conditions: [string, string][] }) {
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
        <div className="mx-auto mb-8 grid size-16 place-items-center rounded-full bg-brand-soft text-brand">
          <Icon name="check" size={28} strokeWidth={2.2} />
        </div>
        {note && <p className="mb-6 text-[15px] text-brand">{note}</p>}
        <h2 className="text-[30px] font-bold">今日のご紹介は以上です</h2>
        <p className="mt-3 text-[15px] text-muted">返事が来たらお知らせします。</p>
        <div className="mt-10 grid gap-3">
          <Link href={`/projects/${projectId}`} className="press flex h-[54px] items-center justify-center rounded-xl bg-brand text-white">
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

  const upcoming = queue.slice(1, 4);

  return (
    <div className="mx-auto grid max-w-[1120px] items-start gap-12 lg:grid-cols-[600px_minmax(0,1fr)]">
    <div className="mx-auto w-[92vw] max-w-[600px] sm:w-full">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <Kicker className="min-w-0 truncate">比べる前に、合う会社を</Kicker>
        <span className="tnum shrink-0 text-[13px] text-muted">
          <span className="font-semibold text-ink">{deck.length - queue.length + 1}</span> / {deck.length}社
        </span>
      </div>

      <div className="relative pb-5">
        {/* the next cards, peeking from behind */}
        {queue.length > 2 && <div className="absolute inset-x-8 bottom-0 h-16 rounded-b-[28px] bg-surface/70 shadow-[var(--shadow-card)]" aria-hidden="true" />}
        {queue.length > 1 && <div className="absolute inset-x-4 bottom-2.5 h-16 rounded-b-[28px] bg-surface shadow-[var(--shadow-card)]" aria-hidden="true" />}
        <article
          key={current.matchId}
          className="animate-fade-up relative touch-pan-y select-none overflow-hidden rounded-[28px] bg-surface shadow-[var(--shadow-deck)]"
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
          <div className="relative aspect-[4/3] bg-soft lg:aspect-[16/10]">
            {current.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.photo} alt={current.photoCaption ? `施工事例：${current.photoCaption}` : `${current.name}の施工写真`} className="size-full object-cover" draggable={false} />
            )}
            <div className="scrim-b pointer-events-none absolute inset-0" />
            {current.photoCaption && <span className="absolute bottom-4 left-5 right-5 truncate text-[13px] text-white/90">施工事例　{current.photoCaption}</span>}
            {current.wantsYou && (
              <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-3 py-1.5 text-[13px] font-medium text-ink shadow-[var(--shadow-card)]">
                <span className="size-1.5 rounded-full bg-accent" />
                この会社も対応を希望しています
              </span>
            )}
            {hint && (
              <span
                className={cx(
                  "absolute top-5 rounded-xl border-2 px-3 py-1 text-[15px] font-semibold",
                  hint === "consult" ? "right-5 border-brand bg-surface/95 text-brand" : "left-5 border-ink bg-surface/95 text-ink",
                )}
              >
                {hint === "consult" ? "相談したい" : "興味なし"}
              </span>
            )}
          </div>
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="jp text-[24px] font-bold leading-tight sm:text-[26px]">{current.name}</h2>
              <span className="tnum shrink-0 pt-1 text-[16px] font-semibold">
                ★ {current.rating.toFixed(1)}
                <span className="font-normal text-muted">（{current.reviews}）</span>
              </span>
            </div>
            <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
              <span className="text-[12px] text-muted">価格帯</span>
              <span className="text-[12px] text-muted">エリア</span>
              <span className="tnum text-[18px] font-semibold">{current.priceBand}</span>
              <span className="truncate text-[15px] leading-[27px]">{current.areas}</span>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap gap-1.5 overflow-hidden" style={{ maxHeight: 30 }}>
                {current.specialties
                  .split("・")
                  .filter(Boolean)
                  .map((t) => (
                    <span key={t} className="rounded-full bg-brand-soft px-2.5 py-1 text-[12px] font-medium text-brand">
                      {t}
                    </span>
                  ))}
              </div>
              <Link href={`/company/${current.companyId}?project=${projectId}`} className="flex min-h-11 shrink-0 items-center gap-0.5 text-[14px] font-medium text-brand">
                詳しく見る
                <Icon name="chevron-right" size={16} />
              </Link>
            </div>
          </div>
        </article>
      </div>

      <p className={cx("mt-2 min-h-6 text-center text-[13px]", error ? "text-danger" : note ? "text-brand" : "text-muted")} role="status">
        {error ?? note ?? (canConsult ? `あと${left}社まで相談できます` : "相談は3社まで送りました")}
      </p>

      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] mt-1 grid grid-cols-[1fr_1fr_1.4fr] gap-3 bg-canvas/90 py-3 backdrop-blur-md md:static md:bg-transparent md:backdrop-blur-none">
        <DeckButton label="興味なし" icon="x" tone="neutral" onClick={() => act("pass")} disabled={pending} />
        <DeckButton label="保存" icon="heart" tone="white" onClick={() => act("save")} disabled={pending} />
        <DeckButton label="相談したい" icon="check" tone="primary" onClick={() => act("consult")} disabled={pending || !canConsult} />
      </div>
      <p className="mt-1 hidden text-center text-[12px] text-faint md:block">キーボード：← 興味なし　→ 相談したい　S 保存</p>
    </div>

    {/* wide screens: the conditions and who comes next */}
    <aside className="hidden max-w-[400px] pt-10 lg:block">
      <div className="rounded-[24px] border border-line/70 bg-surface p-5 shadow-[var(--shadow-card)]">
        <Kicker>あなたの条件</Kicker>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
          {conditions.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[12px] text-muted">{k}</dt>
              <dd className="truncate text-[15px] font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      {upcoming.length > 0 && (
        <div className="mt-7">
          <div className="px-1 text-[12px] font-medium text-muted">このあとの会社</div>
          <ul className="mt-2 divide-y divide-line/70">
            {upcoming.map((c) => (
              <li key={c.matchId} className="flex items-center gap-3 px-1 py-2.5 opacity-80">
                <span className="size-11 shrink-0 overflow-hidden rounded-xl bg-soft">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.photo && <img src={c.photo} alt="" className="size-full object-cover" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium">{c.name}</span>
                  <span className="tnum block text-[12px] text-muted">★ {c.rating.toFixed(1)}・{c.priceBand}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
    </div>
  );
}

function DeckButton({ label, icon, onClick, disabled, tone }: { label: string; icon: string; onClick: () => void; disabled?: boolean; tone: "neutral" | "white" | "primary" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "press flex h-[66px] flex-col items-center justify-center gap-1 rounded-xl text-[13px] font-medium disabled:opacity-40",
        tone === "primary" && "bg-brand text-[15px] text-white shadow-[0_10px_24px_-10px_rgb(24_77_58/0.7)] hover:bg-brand-2",
        tone === "white" && "border border-line bg-surface text-ink shadow-[var(--shadow-card)]",
        tone === "neutral" && "bg-[#e9ebe6] text-ink-2 hover:bg-[#e2e4de]",
      )}
    >
      <Icon name={icon} size={tone === "primary" ? 22 : 20} strokeWidth={2.2} />
      {label}
    </button>
  );
}
