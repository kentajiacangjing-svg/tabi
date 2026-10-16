import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { DemoLogin, LoginForm } from "@/components/auth-forms";

export const metadata = { title: "ログイン" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : homeFor(user.role));
  const demo = process.env.DEMO_MODE !== "false";
  return (
    <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
      <div className="rounded-3xl border border-line bg-white p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">ログイン</h1>
        <p className="mt-1.5 text-sm text-muted">一般の方・企業の方共通です。</p>
        <div className="mt-6">
          <LoginForm next={next} />
        </div>
        <div className="mt-6 space-y-2 text-center text-sm text-muted">
          <div>
            はじめての方は <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand">新規登録</Link>
          </div>
          <div>
            工事会社の方は <Link href="/business/signup" className="font-semibold text-brand">企業登録</Link>
          </div>
        </div>
      </div>
      {demo && (
        <div className="rounded-3xl border border-dashed border-line bg-white/60 p-6 sm:p-8">
          <h2 className="font-bold">デモアカウントで試す</h2>
          <p className="mb-5 mt-1 text-sm text-muted">ワンクリックでログインし、各立場の画面を確認できます。</p>
          <DemoLogin />
        </div>
      )}
    </div>
  );
}
