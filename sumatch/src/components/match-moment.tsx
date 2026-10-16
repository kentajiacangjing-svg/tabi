import Link from "next/link";
import { buttonClass } from "./ui";

/** The one place SUMATCH lets itself feel something: short, quiet, coral used once. */
export function MatchMoment({ title, sub, cta, href, laterHref }: { title: string; sub: string; cta: string; href: string; laterHref: string }) {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-[560px] flex-col justify-center py-10">
      <div className="animate-match">
        <svg width="56" height="32" viewBox="0 0 56 32" aria-hidden="true" className="mb-8">
          <rect x="1" y="1" width="30" height="30" rx="6" fill="#151515" />
          <rect x="25" y="1" width="30" height="30" rx="6" fill="#e86a4a" fillOpacity=".9" />
        </svg>
        <h1 className="jp text-[40px] font-semibold leading-tight sm:text-[48px]">{title}</h1>
        <p className="mt-4 text-[18px] leading-relaxed text-ink-2">{sub}</p>
        <Link href={href} className={buttonClass("primary", "lg", "mt-12 w-full")}>
          {cta}
        </Link>
        <Link href={laterHref} className="mt-4 flex min-h-11 items-center justify-center text-[15px] text-muted hover:text-ink">
          あとで
        </Link>
      </div>
    </div>
  );
}
