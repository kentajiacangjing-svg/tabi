import Link from "next/link";
import { Icon } from "./icons";

/**
 * The best moment in the product. The company's work fills the screen; the words come up over it
 * with a soft scale + fade + blur clearing (~0.7s). The warm accent appears only on the small check.
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
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-ink text-white">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="animate-reveal absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-brand" />
      )}
      <div className="scrim-full absolute inset-0" />

      <div className="relative mx-auto flex w-full max-w-[1080px] items-center px-5 pt-[max(env(safe-area-inset-top),16px)] sm:px-8">
        <span className="flex h-12 items-center text-[15px] font-semibold tracking-[0.14em] text-white/90">SUMATCH</span>
      </div>

      <div className="relative mx-auto flex w-full max-w-[460px] flex-1 flex-col items-center justify-center px-6 text-center">
        <span className="animate-match grid size-14 place-items-center rounded-full bg-accent text-white shadow-[0_10px_30px_-8px_rgb(217_122_74/0.8)]" aria-hidden="true">
          <Icon name="check" size={28} strokeWidth={2.6} />
        </span>
        <div className="animate-match-late mt-7">
          <p className="text-[15px] font-medium tracking-wide text-white/80">相談できます</p>
          <h1 className="jp mt-2 text-[44px] font-bold leading-[1.1] tracking-tight sm:text-[56px]">{title}</h1>
          <p className="mt-4 text-[20px] font-semibold">{sub}</p>
        </div>
      </div>

      <div className="animate-match-late relative mx-auto w-full max-w-[460px] px-6 pb-[max(env(safe-area-inset-bottom),24px)]">
        <Link href={href} className="press flex h-14 w-full items-center justify-center rounded-2xl bg-surface text-[16px] font-semibold text-brand shadow-[0_12px_30px_-12px_rgb(0_0_0/0.5)] hover:bg-white">
          {cta}
        </Link>
        <Link href={laterHref} className="mt-2 flex min-h-12 items-center justify-center text-[15px] text-white/80 hover:text-white">
          あとで
        </Link>
      </div>
    </div>
  );
}
