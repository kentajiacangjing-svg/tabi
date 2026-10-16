import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { SignupForm } from "@/components/auth-forms";

export const metadata = { title: "新規登録" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  return (
    <div className="w-full max-w-[440px]">
      <h1 className="text-[30px] font-semibold">登録</h1>
      <p className="mt-1.5 text-sm text-muted">相談の管理・会社とのチャットに使います。</p>
      <div className="mt-6">
        <SignupForm next={next} />
      </div>
      <div className="mt-6 text-center text-sm text-muted">
        登録済みの方は <Link href="/login" className="font-semibold text-brand">ログイン</Link>
      </div>
    </div>
  );
}
