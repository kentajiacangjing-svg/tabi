import Link from "next/link";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { Logo } from "./brand";

export async function SiteHeader({ business }: { business?: boolean }) {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/95">
      <div className="mx-auto flex h-[60px] max-w-[1320px] items-center justify-between gap-3 px-5 sm:px-10 md:h-[68px] lg:px-12">
        <Logo href={business ? "/business" : "/"} sub={business ? "for Business" : undefined} />
        <nav className="flex items-center gap-1 text-[15px]">
          {user ? (
            <Link href={homeFor(user.role)} className="flex min-h-11 items-center rounded-lg px-3 text-ink-2 hover:bg-soft">
              マイページ
            </Link>
          ) : (
            <Link href={business ? "/login?next=/business/dashboard" : "/login"} className="flex min-h-11 items-center rounded-lg px-3 text-ink-2 hover:bg-soft">
              ログイン
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-5 py-10 text-[14px] text-muted sm:flex-row sm:justify-between sm:px-8">
        <span>
          © {new Date().getFullYear()} SUMATCH
          <span className="sample-tag mt-1 block text-warn">デモ環境です。表示されている会社・お客様・口コミ・写真はサンプルです。</span>
        </span>
        <span className="flex gap-6">
          <Link href="/" className="hover:text-ink">
            工事の相談をする
          </Link>
          <Link href="/business" className="hover:text-ink">
            施工会社の方へ
          </Link>
        </span>
      </div>
    </footer>
  );
}
