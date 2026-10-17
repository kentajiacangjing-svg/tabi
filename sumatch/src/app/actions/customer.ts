"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { get, insert, newId, now, update } from "@/lib/db";
import { ActionError, actionUser, getCurrentUser } from "@/lib/auth";
import { createCustomer } from "@/lib/accounts";
import { formFiles, formObject, handle } from "@/lib/action";
import { saveUpload } from "@/lib/files";
import { estimateRange } from "@/lib/estimate";
import { BUDGETS, CONTACT_TIMES, HOUSE_TYPES, MAX_PROJECT_PHOTOS, TIMINGS } from "@/lib/constants";
import {
  customerRequest,
  customerWithdraw,
  customerMark,
  generateCandidates,
  notifyNewLeads,
  trackEvent,
  decideCompany,
  advanceContract,
  recalcCompanyRating,
  DomainError,
} from "@/lib/services";
import { matchForUser, projectForCustomer } from "@/lib/access";
import { notify, companyUserIds } from "@/lib/notify";
import type { Area, Category, Contract, Project } from "@/lib/types";

const diagnosisSchema = z.object({
  category_id: z.string().min(1, "カテゴリを選んでください。"),
  postal_code: z
    .string()
    .regex(/^(\d{3}-?\d{4})?$/, "郵便番号は7桁で入力してください。")
    .optional()
    .default(""),
  prefecture: z.string().min(1, "都道府県を選んでください。"),
  city: z.string().min(1, "市区町村を選んでください。"),
  // Optional since the flow asks only what / budget / when / where; companies can ask in chat.
  house_type: z.union([z.enum(HOUSE_TYPES), z.literal("")]).default(""),
  building_age: z.coerce.number().int().min(0).max(150).optional().or(z.literal("").transform(() => undefined)),
  concerns: z.string().max(400).default(""),
  details: z.string().max(2000).default(""),
  desired_timing: z.enum(TIMINGS.map((t) => t.value) as [string, ...string[]], { message: "希望時期を選んでください。" }),
  budget: z.enum(BUDGETS.map((b) => b.value) as [string, ...string[]], { message: "予算を選んでください。" }),
  contact_time: z.string().refine((v) => v === "" || (CONTACT_TIMES as readonly string[]).includes(v), "連絡可能時間帯を選んでください。"),
  // inline signup (only when not logged in)
  name: z.string().max(40).optional(),
  email: z.string().max(120).optional(),
  password: z.string().max(100).optional(),
});

export async function submitDiagnosisAction(fd: FormData) {
  return handle(async () => {
    const input = diagnosisSchema.parse(formObject(fd));
    const photos = formFiles(fd, "photos");
    if (photos.length > MAX_PROJECT_PHOTOS) throw new ActionError(`写真は${MAX_PROJECT_PHOTOS}枚までです。`);

    let user = await getCurrentUser();
    if (user && user.role !== "customer") throw new ActionError("企業・運営アカウントでは相談を作成できません。一般ユーザーとしてログインしてください。");
    if (!user) {
      const acct = z
        .object({
          name: z.string().min(1, "お名前（ニックネーム可）を入力してください。"),
          email: z.string().email("メールアドレスの形式が正しくありません。"),
          password: z.string().min(8, "パスワードは8文字以上にしてください。"),
        })
        .parse(input);
      await createCustomer(acct);
      user = { id: get<{ id: string }>("SELECT id FROM users WHERE email = ?", acct.email.toLowerCase())!.id } as never;
    }
    const userId = (user as { id: string }).id;

    const category = get<Category>("SELECT * FROM categories WHERE id = ? AND active = 1", input.category_id);
    if (!category) throw new ActionError("カテゴリが見つかりません。");
    const area = get<Area>("SELECT * FROM service_areas WHERE prefecture = ? AND city = ? AND active = 1", input.prefecture, input.city);
    const budget = BUDGETS.find((b) => b.value === input.budget)!;
    const age = typeof input.building_age === "number" ? input.building_age : null;
    const est = estimateRange({ priceMin: category.price_min, priceMax: category.price_max, houseType: input.house_type, buildingAge: age });

    const id = newId("pj");
    const ts = now();
    insert("projects", {
      id,
      customer_id: userId,
      category_id: category.id,
      area_id: area?.id ?? null,
      title: `${category.name}の相談`,
      postal_code: input.postal_code,
      prefecture: input.prefecture,
      city: input.city,
      house_type: input.house_type,
      building_age: age,
      concerns: input.concerns,
      details: input.details,
      desired_timing: input.desired_timing,
      budget_min: budget.min,
      budget_max: budget.max,
      contact_time: input.contact_time,
      estimate_min: est.min,
      estimate_max: est.max,
      status: "consulting",
      created_at: ts,
      updated_at: ts,
    });
    let i = 0;
    for (const f of photos) {
      const file = await saveUpload(f, { ownerUserId: userId, scope: "project", scopeId: id, allow: ["image"] });
      insert("project_images", { id: newId("pi"), project_id: id, file_id: file.id, sort: i++, created_at: ts });
    }
    const project = get<Project>("SELECT * FROM projects WHERE id = ?", id)!;
    const created = generateCandidates(project);
    notifyNewLeads(project, created);
    trackEvent("diagnosis_complete", userId, (await cookies()).get("sm_vid")?.value ?? null, category.slug);
    return { projectId: id };
  });
}

export async function trackAction(kind: "visit" | "diagnosis_start") {
  const jar = await cookies();
  let vid = jar.get("sm_vid")?.value;
  if (!vid) {
    vid = newId("v");
    jar.set("sm_vid", vid, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  // de-duplicate per visitor per day
  const day = now().slice(0, 10);
  if (!get("SELECT 1 FROM events WHERE kind = ? AND session_key = ? AND substr(created_at, 1, 10) = ?", kind, vid, day)) {
    const user = await getCurrentUser();
    trackEvent(kind, user?.id, vid);
  }
}

export async function requestMatchAction(matchId: string) {
  return handle(async () => {
    const user = await actionUser(["customer"]);
    const m = customerRequest(matchId, user.id);
    revalidatePath("/matches");
    return { status: m.status, matchId: m.id };
  });
}

export async function markCompanyAction(matchId: string, mark: "save" | "unsave" | "pass" | "unpass") {
  return handle(async () => {
    const user = await actionUser(["customer"]);
    customerMark(matchId, user.id, mark);
    revalidatePath("/saved");
    return {};
  });
}

/** Funnel metric 「会社閲覧」: counted once per (project, company) card shown. */
export async function trackCompanyViewAction(matchId: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== "customer") return;
  if (get("SELECT 1 FROM events WHERE kind = 'company_view' AND meta = ?", matchId)) return;
  const m = get<{ customer_id: string }>("SELECT p.customer_id FROM matches m JOIN projects p ON p.id = m.project_id WHERE m.id = ?", matchId);
  if (m?.customer_id === user.id) trackEvent("company_view", user.id, null, matchId);
}

export async function withdrawRequestAction(matchId: string) {
  return handle(async () => {
    const user = await actionUser(["customer"]);
    customerWithdraw(matchId, user.id);
    revalidatePath("/matches");
    return {};
  });
}

const decideSchema = z.object({
  match_id: z.string().min(1),
  quote_id: z.string().optional().default(""),
  amount: z.coerce.number({ message: "契約予定金額を入力してください。" }).int().min(1, "契約予定金額を入力してください。").max(1_000_000_000),
  contract_date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).default(""),
  start_date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).default(""),
  notes: z.string().max(1000).default(""),
});

export async function decideCompanyAction(fd: FormData) {
  return handle(async () => {
    const user = await actionUser(["customer"]);
    const input = decideSchema.parse(formObject(fd));
    const ctx = matchForUser(input.match_id, user);
    if (!ctx || ctx.side !== "customer") throw new ActionError("この操作は許可されていません。");
    if (input.quote_id && !get("SELECT 1 FROM quotes WHERE id = ? AND match_id = ?", input.quote_id, ctx.match.id))
      throw new ActionError("見積が見つかりません。");
    const [file] = formFiles(fd, "contract_file");
    const saved = file ? await saveUpload(file, { ownerUserId: user.id, scope: "match", scopeId: ctx.match.id, allow: ["pdf", "image"] }) : null;
    decideCompany(ctx, {
      quoteId: input.quote_id || null,
      amount: input.amount,
      contractDate: input.contract_date || null,
      startDate: input.start_date || null,
      contractFileId: saved?.id ?? null,
      notes: input.notes,
    });
    revalidatePath("/projects");
    return { projectId: ctx.project.id };
  });
}

export async function advanceContractAction(contractId: string, to: "in_progress" | "completed") {
  return handle(async () => {
    const user = await actionUser(["customer", "business"]);
    const c = get<Contract>("SELECT * FROM contracts WHERE id = ?", contractId);
    if (!c) throw new ActionError("契約が見つかりません。");
    const ctx = matchForUser(c.match_id, user);
    if (!ctx || ctx.side === "admin") throw new ActionError("この操作は許可されていません。");
    advanceContract(c, to, ctx.side === "customer" ? "お客様" : ctx.company.name);
    revalidatePath(`/projects/${c.project_id}`);
    return {};
  });
}

const reviewSchema = z.object({
  project_id: z.string().min(1),
  rating: z.coerce.number().int().min(1, "評価を選んでください。").max(5),
  title: z.string().max(60).default(""),
  body: z.string().min(10, "10文字以上で感想を書いてください。").max(1000),
});

export async function reviewAction(fd: FormData) {
  return handle(async () => {
    const user = await actionUser(["customer"]);
    const input = reviewSchema.parse(formObject(fd));
    const project = projectForCustomer(input.project_id, user);
    if (!project) throw new ActionError("案件が見つかりません。");
    const c = get<Contract>("SELECT * FROM contracts WHERE project_id = ?", project.id);
    if (!c || c.status !== "completed") throw new ActionError("工事完了後に口コミを投稿できます。");
    if (get("SELECT 1 FROM reviews WHERE project_id = ?", project.id)) throw new ActionError("この案件の口コミは投稿済みです。");
    insert("reviews", {
      id: newId("rv"),
      company_id: c.company_id,
      project_id: project.id,
      customer_id: user.id,
      rating: input.rating,
      title: input.title,
      body: input.body,
      author_label: `${project.city}`,
      created_at: now(),
    });
    recalcCompanyRating(c.company_id);
    notify(companyUserIds(c.company_id), "company_review", "口コミが投稿されました", `★${input.rating} ${input.title}`, "/business/profile");
    revalidatePath(`/projects/${project.id}`);
    return {};
  });
}

export async function cancelProjectAction(projectId: string) {
  return handle(async () => {
    const user = await actionUser(["customer"]);
    const p = projectForCustomer(projectId, user);
    if (!p) throw new ActionError("案件が見つかりません。");
    if (!["consulting", "quoting", "comparing"].includes(p.status)) throw new DomainError("契約後の案件は取り下げできません。");
    update("projects", p.id, { status: "cancelled", updated_at: now() });
    revalidatePath("/projects");
    return {};
  });
}

const accountSchema = z.object({
  name: z.string().min(1, "お名前を入力してください。").max(40),
  notify_email: z.string().optional(),
  notify_browser: z.string().optional(),
});

export async function updateAccountAction(fd: FormData) {
  return handle(async () => {
    const user = await actionUser();
    const input = accountSchema.parse(formObject(fd));
    update("users", user.id, { name: input.name, notify_email: input.notify_email ? 1 : 0, notify_browser: input.notify_browser ? 1 : 0 });
    revalidatePath("/", "layout");
    return {};
  });
}

export async function changePasswordAction(fd: FormData) {
  return handle(async () => {
    const user = await actionUser();
    const { current, next } = z
      .object({ current: z.string().min(1, "現在のパスワードを入力してください。"), next: z.string().min(8, "新しいパスワードは8文字以上にしてください。").max(100) })
      .parse(formObject(fd));
    const { verifyPassword, hashPassword } = await import("@/lib/password");
    const row = get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", user.id)!;
    if (!verifyPassword(current, row.password_hash)) throw new ActionError("現在のパスワードが違います。");
    update("users", user.id, { password_hash: hashPassword(next) });
    return {};
  });
}

export async function markNotificationsReadAction() {
  return handle(async () => {
    const user = await actionUser();
    const { run } = await import("@/lib/db");
    run("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL", now(), user.id);
    revalidatePath("/", "layout");
    return {};
  });
}

const reportSchema = z.object({
  target_type: z.enum(["match", "company", "user", "message"]),
  target_id: z.string().min(1),
  reason: z.string().min(1, "理由を選んでください。").max(60),
  detail: z.string().max(1000).default(""),
});

export async function reportAction(fd: FormData) {
  return handle(async () => {
    const user = await actionUser();
    const input = reportSchema.parse(formObject(fd));
    if (input.target_type === "match" && !matchForUser(input.target_id, user)) throw new ActionError("対象が見つかりません。");
    insert("reports", { id: newId("rp"), reporter_user_id: user.id, ...input, created_at: now() });
    const { adminUserIds } = await import("@/lib/notify");
    notify(adminUserIds(), "system", "通報がありました", input.reason, "/admin?tab=reports");
    return {};
  });
}
