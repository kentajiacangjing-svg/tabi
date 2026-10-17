import Link from "next/link";
import { buttonClass } from "./ui";

/**
 * The best moment in the product: quiet, centered, a single soft scale-up (≈0.55s).
 * Coral appears only here.
 */
export function MatchMoment({
  title,
  sub,
  cta,
  href,
  laterHref,
  photo,
  initial,
}: {
  title: string;
  sub: string;
  cta: string;
  href: string;
  laterHref: string;
  photo?: string | null;
  initial?: string;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-9rem)] max-w-[440px] flex-col items-center justify-center py-8 text-center">
      <div className="animate-match relative">
        <div className="size-40 overflow-hidden rounded-[32px] bg-soft shadow-[var(--shadow-pop)] sm:size-48">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-[56px] font-medium text-ink-2">{initial}</div>
          )}
        </div>
        <span className="absolute -bottom-3 -right-3 grid size-12 place-items-center rounded-2xl bg-match text-[22px] text-white shadow-[var(--shadow-pop)]" aria-hidden="true">
          ✓
        </span>
      </div>
      <div className="animate-match-late mt-12 w-full">
        <h1 className="jp text-[38px] font-semibold leading-tight sm:text-[44px]">{title}</h1>
        <p className="mt-3 text-[17px] text-ink-2">{sub}</p>
        <Link href={href} className={buttonClass("primary", "lg", "mt-12 w-full")}>
          {cta}
        </Link>
        <Link href={laterHref} className="mt-3 flex min-h-12 items-center justify-center text-[15px] text-muted hover:text-ink">
          あとで
        </Link>
      </div>
    </div>
  );
}
