"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { all, get, insert, newId, now, run, tx, update } from "@/lib/db";
import { ActionError, actionBusiness, createSession, getCurrentUser, hashPassword } from "@/lib/auth";
import { formFiles, formObject, handle } from "@/lib/action";
import { saveUpload } from "@/lib/files";
import { getSetting } from "@/lib/queries";
import { adminUserIds, notify } from "@/lib/notify";
import type { Plan } from "@/lib/types";

const url = z
  .string()
  .max(300)
  .refine((v) => v === "" || /^https?:\/\/[^\s]+$/.test(v), "URLは http:// または https:// から入力してください。")
  .default("");

const phone = z
  .string()
  .regex(/^[0-9+\-() ]{10,16}$/, "電話番号の形式が正しくありません。");

const profileFields = {
  name: z.string().min(1, "会社名を入力してください。").max(80),
  address: z.string().min(1, "所在地を入力してください。").max(200),
  phone,
  email: z.string().email("メールアドレスの形式が正しくありません。").max(120),
  contact_person: z.string().min(1, "担当者名を入力してください。").max(40),
  tagline: z.string().max(80).default(""),
  description: z.string().max(2000).default(""),
  specialties: z.string().max(300).default(""),
  warranty: z.string().max(300).default(""),
  website_url: url,
  sns_url: url,
  business_hours: z.string().max(100).default(""),
  license_number: z.string().max(100).default(""),
  corporate_number: z.string().regex(/^(\d{13})?$/, "法人番号は13桁の数字です。").default(""),
  qualifications: z.string().max(300).default(""),
  price_band_min: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
  price_band_max: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
  lead_time_weeks: z.coerce.number().int().min(0).max(52).default(4),
  self_construction: z.string().optional(),
};

const signupSchema = z.object({
  ...profileFields,
  owner_name: z.string().min(1, "管理者のお名前を入力してください。").max(40),
  login_email: z.string().email("ログイン用メールアドレスの形式が正しくありません。").max(120),
  password: z.string().min(8, "パスワードは8文字以上にしてください。").max(100),
  plan_code: z.string().default("STARTER"),
  agree: z.literal("on", { message: "利用規約への同意が必要です。" }),
});

function setCategoriesAndAreas(companyId: string, fd: FormData) {
  const catIds = fd.getAll("category_ids").map(String);
  const areaIds = fd.getAll("area_ids").map(String);
  if (!catIds.length) throw new ActionError("対応カテゴリを1つ以上選んでください。");
  if (!areaIds.length) throw new ActionError("対応エリアを1つ以上選んでください。");
  const validCats = new Set(all<{ id: string }>("SELECT id FROM categories").map((r) => r.id));
  const validAreas = new Set(all<{ id: string }>("SELECT id FROM service_areas").map((r) => r.id));
  const prevWorks = new Map(
    all<{ category_id: string; works_count: number }>("SELECT category_id, works_count FROM company_categories WHERE company_id = ?", companyId).map((r) => [
      r.category_id,
      r.works_count,
    ]),
  );
  run("DELETE FROM company_categories WHERE company_id = ?", companyId);
  run("DELETE FROM company_areas WHERE company_id = ?", companyId);
  for (const id of new Set(catIds)) {
    if (!validCats.has(id)) continue;
    const raw = Number(fd.get(`works_${id}`));
    const works = Number.isFinite(raw) && raw >= 0 ? Math.min(100000, Math.floor(raw)) : (prevWorks.get(id) ?? 0);
    insert("company_categories", { company_id: companyId, category_id: id, works_count: works });
  }
  for (const id of new Set(areaIds)) if (validAreas.has(id)) insert("company_areas", { company_id: companyId, area_id: id });
}

export async function businessSignupAction(fd: FormData) {
  return handle(async () => {
    const current = await getCurrentUser();
    if (current) throw new ActionError("ログイン中です。企業登録には一度ログアウトしてください。");
    const input = signupSchema.parse(formObject(fd));
    const loginEmail = input.login_email.toLowerCase();
    if (get("SELECT 1 FROM users WHERE email = ?", loginEmail)) throw new ActionError("このログイン用メールアドレスは既に登録されています。");
    const plan = get<Plan>("SELECT * FROM plans WHERE code = ? AND active = 1", input.plan_code) ?? get<Plan>("SELECT * FROM plans WHERE active = 1 ORDER BY sort LIMIT 1");
    const trialDays = Number(getSetting("default_trial_days", "60")) || 0;
    const companyId = newId("co");
    const userId = newId("usr");
    const ts = now();
    tx(() => {
      insert("companies", {
        id: companyId,
        name: input.name,
        status: "pending",
        address: input.address,
        phone: input.phone,
        email: input.email,
        contact_person: input.contact_person,
        tagline: input.tagline,
        description: input.description,
        specialties: input.specialties,
        warranty: input.warranty,
        website_url: input.website_url,
        sns_url: input.sns_url,
        business_hours: input.business_hours,
        license_number: input.license_number,
        corporate_number: input.corporate_number,
        qualifications: input.qualifications,
        price_band_min: input.price_band_min,
        price_band_max: input.price_band_max,
        lead_time_weeks: input.lead_time_weeks,
        self_construction: input.self_construction ? 1 : 0,
        brand_color: "#3d3a35",
        plan_id: plan?.id ?? null,
        trial_ends_at: trialDays ? new Date(Date.now() + trialDays * 86400_000).toISOString().slice(0, 10) : null,
        created_at: ts,
      });
      insert("users", { id: userId, email: loginEmail, name: input.owner_name, role: "business", password_hash: hashPassword(input.password), created_at: ts });
      insert("company_members", { company_id: companyId, user_id: userId, member_role: "owner", created_at: ts });
      setCategoriesAndAreas(companyId, fd);
    });
    notify(adminUserIds(), "system", "企業の新規登録がありました", `${input.name}（審査待ち）`, "/admin?tab=companies");
    await createSession(userId);
    return { redirect: "/business/dashboard" };
  });
}

const profileSchema = z.object({ ...profileFields });

export async function updateCompanyProfileAction(fd: FormData) {
  return handle(async () => {
    const { user, membership } = await actionBusiness();
    const input = profileSchema.parse(formObject(fd));
    const id = membership.company.id;
    const [logo] = formFiles(fd, "logo");
    const saved = logo ? await saveUpload(logo, { ownerUserId: user.id, scope: "public", scopeId: id, allow: ["image"] }) : null;
    tx(() => {
      update("companies", id, {
        ...input,
        self_construction: input.self_construction ? 1 : 0,
        ...(saved ? { logo_file_id: saved.id } : {}),
      });
      setCategoriesAndAreas(id, fd);
    });
    revalidatePath("/business/profile");
    return {};
  });
}

const workSchema = z.object({
  title: z.string().min(1, "施工事例のタイトルを入力してください。").max(80),
  category_id: z.string().default(""),
  city: z.string().max(40).default(""),
  cost_label: z.string().max(40).default(""),
});

export async function addWorkAction(fd: FormData) {
  return handle(async () => {
    const { user, membership } = await actionBusiness();
    const input = workSchema.parse(formObject(fd));
    const [img] = formFiles(fd, "image");
    if (!img) throw new ActionError("施工写真を選んでください。");
    const saved = await saveUpload(img, { ownerUserId: user.id, scope: "public", scopeId: membership.company.id, allow: ["image"] });
    insert("company_works", {
      id: newId("wk"),
      company_id: membership.company.id,
      category_id: input.category_id || null,
      title: input.title,
      city: input.city,
      cost_label: input.cost_label,
      file_id: saved.id,
      created_at: now(),
    });
    revalidatePath("/business/profile");
    return {};
  });
}

export async function deleteWorkAction(workId: string) {
  return handle(async () => {
    const { membership } = await actionBusiness();
    run("DELETE FROM company_works WHERE id = ? AND company_id = ?", workId, membership.company.id);
    revalidatePath("/business/profile");
    return {};
  });
}

const memberSchema = z.object({
  name: z.string().min(1, "担当者名を入力してください。").max(40),
  email: z.string().email("メールアドレスの形式が正しくありません。").max(120),
  password: z.string().min(8, "初期パスワードは8文字以上にしてください。").max(100),
});

export async function addMemberAction(fd: FormData) {
  return handle(async () => {
    const { membership } = await actionBusiness();
    if (membership.member_role !== "owner") throw new ActionError("担当者の追加は会社管理者のみ行えます。");
    const input = memberSchema.parse(formObject(fd));
    const email = input.email.toLowerCase();
    if (get("SELECT 1 FROM users WHERE email = ?", email)) throw new ActionError("このメールアドレスは既に登録されています。");
    const id = newId("usr");
    tx(() => {
      insert("users", { id, email, name: input.name, role: "business", password_hash: hashPassword(input.password), created_at: now() });
      insert("company_members", { company_id: membership.company.id, user_id: id, member_role: "staff", created_at: now() });
    });
    revalidatePath("/business/profile");
    return {};
  });
}

export async function removeMemberAction(userId: string) {
  return handle(async () => {
    const { user, membership } = await actionBusiness();
    if (membership.member_role !== "owner") throw new ActionError("担当者の削除は会社管理者のみ行えます。");
    if (userId === user.id) throw new ActionError("自分自身は削除できません。");
    const m = get<{ member_role: string }>("SELECT member_role FROM company_members WHERE company_id = ? AND user_id = ?", membership.company.id, userId);
    if (!m) throw new ActionError("担当者が見つかりません。");
    if (m.member_role === "owner") throw new ActionError("会社管理者は削除できません。");
    tx(() => {
      run("DELETE FROM company_members WHERE company_id = ? AND user_id = ?", membership.company.id, userId);
      run("UPDATE users SET status = 'suspended' WHERE id = ?", userId);
      run("DELETE FROM sessions WHERE user_id = ?", userId);
    });
    revalidatePath("/business/profile");
    return {};
  });
}

export async function changePlanAction(planId: string) {
  return handle(async () => {
    const { membership } = await actionBusiness();
    if (membership.member_role !== "owner") throw new ActionError("プランの変更は会社管理者のみ行えます。");
    const plan = get<Plan>("SELECT * FROM plans WHERE id = ? AND active = 1", planId);
    if (!plan) throw new ActionError("プランが見つかりません。");
    update("companies", membership.company.id, { plan_id: plan.id });
    notify(adminUserIds(), "system", "プラン変更", `${membership.company.name} → ${plan.name}`, "/admin?tab=companies");
    revalidatePath("/business/profile");
    return {};
  });
}

/** SUMATCH Web への関心を記録するだけ。マッチング順位には一切影響しない。 */
export async function webInterestAction() {
  return handle(async () => {
    const { membership } = await actionBusiness();
    update("companies", membership.company.id, { web_interest: 1 });
    notify(adminUserIds(), "system", "SUMATCH Web の相談希望", membership.company.name, "/admin?tab=companies");
    revalidatePath("/business/profile");
    return {};
  });
}
