import Link from "next/link";
import { Logo } from "@/components/brand";
import { Kicker, buttonClass } from "@/components/ui";

export const metadata = { title: "ページが見つかりません" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-[60px] items-center border-b border-line bg-surface px-5 sm:px-10 md:h-[68px]">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col items-center justify-center px-5 py-12 text-center">
        <Kicker>404</Kicker>
        <h1 className="mt-3 text-[28px] font-bold">ページが見つかりません</h1>
        <p className="mt-2 text-[15px] text-muted">URLが変わったか、削除された可能性があります。</p>
        <Link href="/" className={buttonClass("primary", "lg", "mt-8 w-full")}>
          トップへ戻る
        </Link>
      </main>
    </div>
  );
}
