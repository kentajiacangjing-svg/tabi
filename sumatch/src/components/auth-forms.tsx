"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { demoLoginAction, loginAction, signupAction } from "@/app/actions/auth";
import { Button, Field, Input, Notice } from "./ui";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) =>
        start(async () => {
          const r = await loginAction(fd);
          if (!r.ok) return setError(r.error);
          router.push(r.redirect);
          router.refresh();
        })
      }
      className="space-y-4"
    >
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="メールアドレス">
        <Input type="email" name="email" autoComplete="email" required inputMode="email" />
      </Field>
      <Field label="パスワード">
        <Input type="password" name="password" autoComplete="current-password" required />
      </Field>
      {error && <Notice tone="danger" icon="alert">{error}</Notice>}
      <Button className="w-full" size="lg" disabled={pending}>
        {pending ? "ログイン中…" : "ログイン"}
      </Button>
    </form>
  );
}

export function SignupForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) =>
        start(async () => {
          const r = await signupAction(fd);
          if (!r.ok) return setError(r.error);
          router.push(r.redirect);
          router.refresh();
        })
      }
      className="space-y-4"
    >
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="お名前（ニックネーム可）" required>
        <Input name="name" autoComplete="nickname" required maxLength={40} />
      </Field>
      <Field label="メールアドレス" hint="通知の受け取りに使います。会社には公開されません。" required>
        <Input type="email" name="email" autoComplete="email" required inputMode="email" />
      </Field>
      <Field label="パスワード" hint="8文字以上" required>
        <Input type="password" name="password" autoComplete="new-password" required minLength={8} />
      </Field>
      {error && <Notice tone="danger" icon="alert">{error}</Notice>}
      <Button className="w-full" size="lg" disabled={pending}>
        {pending ? "登録中…" : "無料で登録する"}
      </Button>
      <p className="text-center text-[13px] text-muted">電話番号の登録は不要です。</p>
    </form>
  );
}

const DEMO = [
  { group: "一般ユーザー", items: [["yamada@demo.sumatch.jp", "山田 太郎", "比較中の相談あり"], ["ito@demo.sumatch.jp", "伊藤 由美", "相談を出したばかり"]] },
  { group: "企業", items: [["owner@shonan-paint.demo", "湘南ペイント", "管理者"], ["staff@shonan-paint.demo", "湘南ペイント", "担当者"], ["owner@fujisawa-reform.demo", "藤沢リフォーム", "工事中の案件あり"], ["owner@umibe.demo", "海辺の住まい工務店", "審査待ち"]] },
  { group: "運営", items: [["admin@demo.sumatch.jp", "SUMATCH運営", "管理画面"]] },
] as const;

export function DemoLogin() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      {DEMO.map((g) => (
        <div key={g.group}>
          <div className="mb-1 text-[13px] text-muted">{g.group}</div>
          <div className="divide-y divide-line border-y border-line">
            {g.items.map(([email, name, note]) => (
              <button
                key={email}
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await demoLoginAction(email);
                    if (!r.ok) return setError(r.error);
                    router.push(r.redirect);
                    router.refresh();
                  })
                }
                className="flex min-h-12 w-full items-center justify-between gap-3 text-left text-[15px] hover:text-brand disabled:opacity-50"
              >
                <span>{name}</span>
                <span className="text-[13px] text-muted">{note}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {error && <Notice tone="danger">{error}</Notice>}
      <p className="text-[13px] text-muted">
        デモ用パスワードはすべて <code className="rounded bg-soft px-1">sumatch123</code> です。<Link href="/" className="underline">トップへ戻る</Link>
      </p>
    </div>
  );
}
