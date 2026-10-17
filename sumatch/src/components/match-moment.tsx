import Link from "next/link";
import { LogoMark } from "./brand";
import { Icon } from "./icons";
import { Kicker } from "./ui";

/**
 * The brand moment. The company's work, softly blurred, fills the screen behind a dark wash; the same
 * photo sits sharp in a card in front (so it is never blown up past its resolution). Everything comes in
 * with a scale + fade + blur clearing (~0.6s). The warm accent appears only on the check.
 */
export function MatchMoment({
  title,
  sub,
  cta,
  href,
  laterHref,
  photo,
}: {
  title: string;
  /** who you can now talk to (company name, or the customer) */
  sub: string;
  cta: string;
  href: string;
  laterHref: string;
  photo?: string | null;
  initial?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-brand-ink text-white">
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="absolute inset-0 size-full scale-110 object-cover blur-2xl saturate-[0.35]" aria-hidden="true" />
      )}
      <div className="scrim-full absolute inset-0" />

      <div className="relative mx-auto flex w-full max-w-[1320px] items-center gap-2.5 px-5 pt-[max(env(safe-area-inset-top),16px)] sm:px-10 lg:px-12">
        <span className="flex h-12 items-center gap-2.5">
          <span className="rounded-md bg-white/90 p-1">
            <LogoMark size={18} />
          </span>
          <span className="text-[15px] font-bold tracking-[0.16em] text-white/90">SUMATCH</span>
        </span>
      </div>

      <div className="relative mx-auto flex w-full max-w-[460px] flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="animate-reveal relative w-[min(78vw,360px)]">
          <div className="aspect-[4/3] overflow-hidden rounded-[28px] bg-white/10 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.6)] ring-1 ring-white/20">
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="size-full object-cover" />
            )}
          </div>
          <span className="absolute -bottom-5 left-1/2 grid size-12 -translate-x-1/2 place-items-center rounded-full bg-accent text-white shadow-[0_10px_30px_-8px_rgb(217_122_74/0.8)] ring-4 ring-brand-ink/60" aria-hidden="true">
            <Icon name="check" size={24} strokeWidth={2.6} />
          </span>
        </div>
        <div className="animate-match-late mt-10 flex flex-col items-center">
          <Kicker tone="light">相談できます</Kicker>
          <h1 className="jp mt-3 text-[42px] font-bold leading-[1.1] tracking-tight sm:text-[54px]">{title}</h1>
          <p className="mt-3 text-[19px] font-semibold">{sub}</p>
        </div>
      </div>

      <div className="animate-match-late relative mx-auto w-full max-w-[460px] px-6 pb-[max(env(safe-area-inset-bottom),24px)]">
        <Link href={href} className="press flex h-[54px] w-full items-center justify-center rounded-xl bg-surface text-[16px] font-semibold text-brand shadow-[0_12px_30px_-12px_rgb(0_0_0/0.5)] hover:bg-white">
          {cta}
        </Link>
        <Link href={laterHref} className="mt-2 flex min-h-12 items-center justify-center text-[15px] text-white/80 hover:text-white">
          あとで
        </Link>
      </div>
    </div>
  );
}
