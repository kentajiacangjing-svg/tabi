"use server";

import { headers } from "next/headers";
import { clearRateLimit, clientIp, hitRateLimit } from "@/lib/rate-limit";
import { isDemo } from "@/lib/demo";
import { z } from "zod";
import { redirect } from "next/navigation";
import { get } from "@/lib/db";
import { ActionError, createSession, destroySession, homeFor, verifyPassword } from "@/lib/auth";
import { createCustomer } from "@/lib/accounts";
import { formObject, handle } from "@/lib/action";
import type { User } from "@/lib/types";

const safeNext = (next: string | undefined, fallback: string) =>
  next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;

const loginSchema = z.object({
  email: z.string().email("メールアドレスの形式が正しくありません。"),
  password: z.string().min(1, "パスワードを入力してください。"),
  next: z.string().optional(),
});

export async function loginAction(fd: FormData) {
  return handle(async () => {
    const input = loginSchema.parse(formObject(fd));
    // Guessing passwords: per address and per network origin. Counted before the password is checked.
    const emailKey = `login:email:${input.email.toLowerCase()}`;
    hitRateLimit(emailKey, 10, 15 * 60);
    hitRateLimit(`login:ip:${clientIp(await headers())}`, 50, 15 * 60);
    const row = get<User & { password_hash: string }>("SELECT * FROM users WHERE email = ?", input.email.toLowerCase());
    // Sample accounts cannot sign in outside demo mode; the message is the same as a wrong password.
    if (!row || (row.is_demo && !isDemo()) || !verifyPassword(input.password, row.password_hash)) throw new ActionError("メールアドレスまたはパスワードが違います。");
    if (row.status !== "active") throw new ActionError("このアカウントは停止されています。");
    clearRateLimit(emailKey);
    await createSession(row.id);
    return { redirect: safeNext(input.next, homeFor(row.role)) };
  });
}

const signupSchema = z.object({
  name: z.string().min(1, "お名前を入力してください。").max(40),
  email: z.string().email("メールアドレスの形式が正しくありません。").max(120),
  password: z.string().min(8, "パスワードは8文字以上にしてください。").max(100),
});

export async function signupAction(fd: FormData) {
  return handle(async () => {
    const o = formObject(fd);
    const input = signupSchema.parse(o);
    hitRateLimit(`signup:ip:${clientIp(await headers())}`, 20, 60 * 60);
    await createCustomer(input);
    return { redirect: safeNext(o.next, "/diagnosis") };
  });
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function demoLoginAction(email: string) {
  return handle(async () => {
    if (!isDemo()) throw new ActionError("デモログインは無効です。");
    hitRateLimit(`demo-login:ip:${clientIp(await headers())}`, 100, 15 * 60);
    if (!/(\.demo|@demo\.sumatch\.jp)$/.test(email)) throw new ActionError("デモアカウントではありません。");
    const row = get<User>("SELECT * FROM users WHERE email = ?", email);
    if (!row) throw new ActionError("デモアカウントが見つかりません。");
    await createSession(row.id);
    return { redirect: homeFor(row.role) };
  });
}
