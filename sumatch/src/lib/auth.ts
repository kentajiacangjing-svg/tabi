import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "./password";
import { get, insert, run, now } from "./db";
import type { Company, Role, User } from "./types";

export const SESSION_COOKIE = "sm_session";
const SESSION_DAYS = 30;

export { hashPassword, verifyPassword };

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  insert("sessions", { token_hash: tokenHash(token), user_id: userId, expires_at: expires.toISOString(), created_at: now() });
  run("UPDATE users SET last_login_at = ? WHERE id = ?", now(), userId);
  const secure = (process.env.APP_URL ?? "").startsWith("https://");
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) run("DELETE FROM sessions WHERE token_hash = ?", tokenHash(token));
  jar.delete(SESSION_COOKIE);
}

export function userFromToken(token: string | undefined): User | null {
  if (!token) return null;
  const row = get<User & { expires_at: string }>(
    `SELECT u.id, u.email, u.name, u.role, u.status, u.notify_email, u.notify_browser, u.created_at, u.last_login_at, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    tokenHash(token),
  );
  if (!row || row.expires_at < now() || row.status !== "active") return null;
  const { expires_at: _e, ...user } = row;
  return user;
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return userFromToken(token);
});

export interface Membership {
  company: Company;
  member_role: "owner" | "staff";
}

export function membershipFor(userId: string): Membership | null {
  const row = get<{ company_id: string; member_role: "owner" | "staff" }>(
    "SELECT company_id, member_role FROM company_members WHERE user_id = ? ORDER BY created_at LIMIT 1",
    userId,
  );
  if (!row) return null;
  const company = get<Company>("SELECT * FROM companies WHERE id = ?", row.company_id);
  return company ? { company, member_role: row.member_role } : null;
}

/** For pages: redirects to login (or home) when the user is missing or has the wrong role. */
export async function requireUser(roles?: Role[], nextPath?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    const fallback = roles?.includes("business") && !roles.includes("customer") ? "/business" : "/";
    redirect(`/login?next=${encodeURIComponent(nextPath ?? fallback)}`);
  }
  if (roles && !roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

export async function requireBusiness(): Promise<{ user: User; membership: Membership }> {
  const user = await requireUser(["business"], "/business/dashboard");
  const membership = membershipFor(user.id);
  if (!membership) redirect("/business/signup");
  return { user, membership };
}

export function homeFor(role: Role) {
  return role === "admin" ? "/admin" : role === "business" ? "/business/dashboard" : "/projects";
}

export class ActionError extends Error {}

/** For server actions: throws instead of redirecting. */
export async function actionUser(roles?: Role[]): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new ActionError("ログインが必要です。");
  if (roles && !roles.includes(user.role)) throw new ActionError("この操作は許可されていません。");
  return user;
}

export async function actionBusiness(): Promise<{ user: User; membership: Membership }> {
  const user = await actionUser(["business"]);
  const membership = membershipFor(user.id);
  if (!membership) throw new ActionError("企業情報が見つかりません。");
  if (membership.company.status === "suspended") throw new ActionError("アカウントが停止されています。運営にお問い合わせください。");
  return { user, membership };
}
