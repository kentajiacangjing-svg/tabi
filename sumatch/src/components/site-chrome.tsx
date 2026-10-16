import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { Logo } from "./brand";
import { buttonClass } from "./ui";

export async function SiteHeader({ business }: { business?: boolean }) {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo href={business ? "/business" : "/"} sub={business ? "for Business" : undefined} />
        <nav className="flex items-center gap-1">
          {business ? (
            <Link href="/" className="hidden rounded-full px-3 py-2 text-sm text-muted hover:text-ink sm:block">
              一般の方へ
            </Link>
          ) : (
            <Link href="/business" className="hidden rounded-full px-3 py-2 text-sm text-muted hover:text-ink sm:block">
              企業の方へ
            </Link>
          )}
          {user ? (
            <Link href={homeFor(user.role)} className={buttonClass("secondary", "sm")}>
              マイページ
            </Link>
          ) : (
            <Link href="/login" className={buttonClass("ghost", "sm")}>
              ログイン
            </Link>
          )}
          {business ? (
            <Link href="/business/signup" className={buttonClass("dark", "sm")}>
              無料で企業登録
            </Link>
          ) : (
            <Link href="/diagnosis" className={buttonClass("primary", "sm", "hidden sm:inline-flex")}>
              無料で相談する
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-soft/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-[1.5fr_1fr_1fr] sm:px-6">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">探す・比べる・決めるを、ひとつに。住まいと暮らしのサービスを、安心して選べる場所をつくっています。</p>
        </div>
        <FooterCol title="ご利用の方">
          <Link href="/diagnosis">無料で相談する</Link>
          <Link href="/projects">相談の管理</Link>
          <Link href="/login">ログイン</Link>
        </FooterCol>
        <FooterCol title="企業の方">
          <Link href="/business">SUMATCH for Business</Link>
          <Link href="/business/signup">企業登録</Link>
          <Link href="/business/dashboard">企業ログイン</Link>
        </FooterCol>
      </div>
      <div className="border-t border-line py-5 text-center text-[12px] text-faint">© {new Date().getFullYear()} SUMATCH</div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-3 text-[12px] font-semibold tracking-wider text-faint">{title}</div>
      <div className="flex flex-col gap-2 text-sm text-ink-2 [&>a:hover]:text-ink">{children}</div>
    </div>
  );
}
