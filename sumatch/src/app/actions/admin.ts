"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { all, get, insert, newId, now, run, update } from "@/lib/db";
import { ActionError, actionUser } from "@/lib/auth";
import { formObject, handle } from "@/lib/action";
import { notify, companyUserIds } from "@/lib/notify";
import { generateCandidates, notifyNewLeads } from "@/lib/services";
import { setFeeStatus, type FeeStatus } from "@/lib/fees";
import type { Company, Project } from "@/lib/types";

const admin = () => actionUser(["admin"]);
const done = () => {
  revalidatePath("/admin");
  return {};
};

export async function setCompanyStatusAction(companyId: string, status: Company["status"]) {
  return handle(async () => {
    await admin();
    const c = get<Company>("SELECT * FROM companies WHERE id = ?", companyId);
    if (!c) throw new ActionError("企業が見つかりません。");
    update("companies", companyId, { status, ...(status === "approved" && !c.approved_at ? { approved_at: now() } : {}) });
    if (status === "suspended") {
      run("UPDATE users SET status = 'suspended' WHERE id IN (SELECT user_id FROM company_members WHERE company_id = ?)", companyId);
      run("DELETE FROM sessions WHERE user_id IN (SELECT user_id FROM company_members WHERE company_id = ?)", companyId);
    } else {
      run("UPDATE users SET status = 'active' WHERE id IN (SELECT user_id FROM company_members WHERE company_id = ?)", companyId);
    }
    if (status === "approved" && c.status !== "approved") {
      notify(companyUserIds(companyId), "system", "企業審査が完了しました", "SUMATCHで案件を受け取れるようになりました。", "/business/leads");
      // Offer currently open projects in their area/category.
      const since = new Date(Date.now() - 14 * 86400_000).toISOString();
      for (const p of all<Project>("SELECT * FROM projects WHERE status IN ('consulting','quoting','comparing') AND created_at >= ?", since)) {
        notifyNewLeads(p, generateCandidates(p));
      }
    }
    if (status === "rejected") notify(companyUserIds(companyId), "system", "企業審査の結果", "今回は登録をお見送りしました。詳細は運営からご連絡します。", "/business/dashboard");
    return done();
  });
}

export async function setCompanyBillingAction(fd: FormData) {
  return handle(async () => {
    await admin();
    const o = z
      .object({ company_id: z.string().min(1), plan_id: z.string().default(""), trial_ends_at: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).default("") })
      .parse(formObject(fd));
    update("companies", o.company_id, { plan_id: o.plan_id || null, trial_ends_at: o.trial_ends_at || null });
    return done();
  });
}

export async function setUserStatusAction(userId: string, status: "active" | "suspended") {
  return handle(async () => {
    const me = await admin();
    if (me.id === userId) throw new ActionError("自分自身は停止できません。");
    update("users", userId, { status });
    if (status === "suspended") run("DELETE FROM sessions WHERE user_id = ?", userId);
    return done();
  });
}

const categorySchema = z.object({
  id: z.string().default(""),
  slug: z.string().regex(/^[a-z0-9-]{2,40}$/, "スラッグは半角英小文字・数字・ハイフンで入力してください。"),
  name: z.string().min(1, "カテゴリ名を入力してください。").max(30),
  group_name: z.string().max(20).default("住まい"),
  description: z.string().max(100).default(""),
  icon: z.string().max(20).default("home"),
  price_min: z.coerce.number().int().min(0),
  price_max: z.coerce.number().int().min(0),
  price_note: z.string().max(100).default(""),
  concerns: z.string().max(400).default(""),
  sort: z.coerce.number().int().default(0),
  active: z.string().optional(),
});

export async function upsertCategoryAction(fd: FormData) {
  return handle(async () => {
    await admin();
    const c = categorySchema.parse(formObject(fd));
    if (c.price_max < c.price_min) throw new ActionError("相場の上限は下限以上にしてください。");
    const row = {
      slug: c.slug,
      name: c.name,
      group_name: c.group_name,
      description: c.description,
      icon: c.icon,
      price_min: c.price_min,
      price_max: c.price_max,
      price_note: c.price_note,
      concerns: JSON.stringify(c.concerns.split(/[,、\n]/).map((s) => s.trim()).filter(Boolean)),
      sort: c.sort,
      active: c.active ? 1 : 0,
    };
    const dup = get<{ id: string }>("SELECT id FROM categories WHERE slug = ?", c.slug);
    if (dup && dup.id !== c.id) throw new ActionError("このスラッグは既に使われています。");
    if (c.id) update("categories", c.id, row);
    else insert("categories", { id: newId("cat"), ...row, created_at: now() });
    return done();
  });
}

const areaSchema = z.object({
  id: z.string().default(""),
  prefecture: z.string().min(1, "都道府県を入力してください。").max(10),
  city: z.string().min(1, "市区町村を入力してください。").max(20),
  region: z.string().max(20).default(""),
  postal_prefixes: z.string().regex(/^(\d{3})?(,\d{3})*$/, "郵便番号の先頭3桁をカンマ区切りで入力してください。").default(""),
  sort: z.coerce.number().int().default(0),
  active: z.string().optional(),
});

export async function upsertAreaAction(fd: FormData) {
  return handle(async () => {
    await admin();
    const a = areaSchema.parse(formObject(fd));
    const row = { prefecture: a.prefecture, city: a.city, region: a.region, postal_prefixes: a.postal_prefixes, sort: a.sort, active: a.active ? 1 : 0 };
    const dup = get<{ id: string }>("SELECT id FROM service_areas WHERE prefecture = ? AND city = ?", a.prefecture, a.city);
    if (dup && dup.id !== a.id) throw new ActionError("このエリアは既に登録されています。");
    if (a.id) update("service_areas", a.id, row);
    else insert("service_areas", { id: newId("area"), ...row, created_at: now() });
    return done();
  });
}

const planSchema = z.object({
  id: z.string().default(""),
  code: z.string().regex(/^[A-Z0-9_]{2,20}$/, "コードは半角英大文字で入力してください。"),
  name: z.string().min(1).max(30),
  monthly_price: z.coerce.number().int().min(0),
  match_limit: z.coerce.number().int().min(0),
  success_fee_percent: z.coerce.number().min(0).max(30),
  description: z.string().max(100).default(""),
  sort: z.coerce.number().int().default(0),
  active: z.string().optional(),
});

export async function upsertPlanAction(fd: FormData) {
  return handle(async () => {
    await admin();
    const p = planSchema.parse(formObject(fd));
    const row = {
      code: p.code,
      name: p.name,
      monthly_price: p.monthly_price,
      match_limit: p.match_limit,
      success_fee_rate: Math.round(p.success_fee_percent * 10) / 1000,
      description: p.description,
      sort: p.sort,
      active: p.active ? 1 : 0,
    };
    const dup = get<{ id: string }>("SELECT id FROM plans WHERE code = ?", p.code);
    if (dup && dup.id !== p.id) throw new ActionError("このコードは既に使われています。");
    if (p.id) update("plans", p.id, row);
    else insert("plans", { id: newId("plan"), ...row, created_at: now() });
    return done();
  });
}

export async function updateSettingAction(fd: FormData) {
  return handle(async () => {
    await admin();
    const o = z
      .object({ key: z.enum(["default_trial_days", "success_fee_note", "fee_base", "fee_rounding"]), value: z.string().max(200) })
      .refine((x) => x.key !== "fee_base" || ["excl_tax", "incl_tax"].includes(x.value), "税抜か税込を選んでください。")
      .refine((x) => x.key !== "fee_rounding" || ["floor", "round", "ceil"].includes(x.value), "端数処理を選んでください。")
      .parse(formObject(fd));
    run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", o.key, o.value);
    return done();
  });
}

export async function resolveReportAction(reportId: string) {
  return handle(async () => {
    await admin();
    update("reports", reportId, { status: "resolved" });
    return done();
  });
}

/** 成功報酬の記録の状態を手動で変更（請求・決済は行わない）。 */
export async function setFeeStatusAction(feeId: string, fd: FormData) {
  return handle(async () => {
    const user = await admin();
    const o = formObject(fd);
    setFeeStatus(feeId, (o.status ?? "") as FeeStatus, user.id, o.note ?? "");
    return done();
  });
}

/** 退会申請を対応済みにする（データの削除・匿名化は手順書に沿って別途、承認のうえで行う）。 */
export async function handleDeletionRequestAction(requestId: string, fd: FormData) {
  return handle(async () => {
    const user = await admin();
    const note = String(fd.get("note") ?? "").trim().slice(0, 300);
    if (!note) throw new ActionError("対応内容を記録してください。");
    const r = run("UPDATE account_deletion_requests SET status = 'handled', note = ?, handled_by = ?, handled_at = ? WHERE id = ? AND status = 'requested'", note, user.id, now(), requestId);
    if (!r.changes) throw new ActionError("この申請は対応済みか取り下げ済みです。");
    return done();
  });
}
