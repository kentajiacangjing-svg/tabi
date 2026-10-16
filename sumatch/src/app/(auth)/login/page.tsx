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
    <div className="w-full max-w-[440px]">
      <h1 className="text-[30px] font-semibold">ログイン</h1>
      <div className="mt-8">
        <LoginForm next={next} />
      </div>
      <div className="mt-8 space-y-2 text-[15px] text-muted">
        <p>
          はじめての方は<Link href="/" className="text-ink underline underline-offset-4">相談を始める</Link>と、そのまま登録できます。
        </p>
        <p>
          施工会社の方は<Link href="/business/signup" className="text-ink underline underline-offset-4">企業登録</Link>
        </p>
      </div>
      {demo && (
        <details className="mt-12 border-t border-line pt-6">
          <summary className="flex min-h-11 cursor-pointer list-none items-center text-[15px] text-ink-2">デモアカウントで試す</summary>
          <div className="mt-4">
            <DemoLogin />
          </div>
        </details>
      )}
    </div>
  );
}
