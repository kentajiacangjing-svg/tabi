"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { get } from "@/lib/db";
import { ActionError, actionBusiness, actionUser } from "@/lib/auth";
import { formFiles, formObject, handle } from "@/lib/action";
import { saveUpload } from "@/lib/files";
import { matchForUser } from "@/lib/access";
import { markRead, postMessage, submitQuote, companyRespond } from "@/lib/services";
import { messagesFor } from "@/lib/queries";
import { draftReply } from "@/lib/ai-draft";
import type { Category } from "@/lib/types";

export async function sendMessageAction(fd: FormData) {
  return handle(async () => {
    const user = await actionUser(["customer", "business"]);
    const o = formObject(fd);
    const ctx = matchForUser(o.match_id ?? "", user);
    if (!ctx) throw new ActionError("チャットが見つかりません。");
    const body = (o.body ?? "").slice(0, 4000);
    const [file] = formFiles(fd, "file");
    if (file) {
      const saved = await saveUpload(file, { ownerUserId: user.id, scope: "match", scopeId: ctx.match.id, allow: ["image", "pdf"] });
      postMessage(ctx, user.id, { kind: saved.mime === "application/pdf" ? "file" : "image", body, fileId: saved.id });
      return { flags: [] as string[] };
    }
    if (!body) throw new ActionError("メッセージを入力してください。");
    const r = postMessage(ctx, user.id, { kind: "text", body });
    return { flags: r.flags as string[] };
  });
}

export async function markReadAction(matchId: string) {
  const user = await actionUser();
  const ctx = matchForUser(matchId, user);
  if (ctx) markRead(ctx);
}

export async function draftReplyAction(matchId: string) {
  return handle(async () => {
    const user = await actionUser(["customer", "business"]);
    const ctx = matchForUser(matchId, user);
    if (!ctx || ctx.side === "admin") throw new ActionError("チャットが見つかりません。");
    const cat = get<Category>("SELECT * FROM categories WHERE id = ?", ctx.project.category_id);
    const customer = get<{ name: string }>("SELECT name FROM users WHERE id = ?", ctx.project.customer_id);
    const draft = await draftReply({
      side: ctx.side,
      companyName: ctx.company.name,
      customerName: customer?.name.split(" ")[0] ?? "お客",
      categoryName: cat?.name ?? "",
      city: ctx.project.city,
      projectSummary: `${ctx.project.city}・${ctx.project.house_type}・${cat?.name ?? ""}。${ctx.project.concerns} ${ctx.project.details}`.slice(0, 600),
      messages: messagesFor(ctx.match.id),
    });
    return draft;
  });
}

/* ---------------- business: leads ---------------- */

export async function respondLeadAction(projectId: string, yes: boolean) {
  return handle(async () => {
    const { membership } = await actionBusiness();
    const m = companyRespond(projectId, membership.company.id, yes);
    revalidatePath("/business/leads");
    revalidatePath("/business/dashboard");
    return { status: m.status, matchId: m.id };
  });
}

/* ---------------- business: quotes ---------------- */

const num = (msg: string) => z.coerce.number({ message: msg }).finite();

const quoteSchema = z.object({
  match_id: z.string().min(1),
  title: z.string().min(1, "見積もりの件名を入力してください。").max(120),
  items: z
    .array(
      z.object({
        name: z.string().min(1, "工事項目名を入力してください。").max(120),
        quantity: num("数量を入力してください。").min(0).max(100000),
        unit: z.string().max(10).default("式"),
        unit_price: num("単価を入力してください。").int().min(0).max(100_000_000),
      }),
    )
    .min(1, "工事項目を1つ以上入力してください。")
    .max(60),
  overhead: num("諸経費を入力してください。").int().min(0).max(100_000_000).default(0),
  discount: num("値引きを入力してください。").int().min(0).max(100_000_000).default(0),
  warranty: z.string().max(200).default(""),
  warranty_years: num("保証年数を入力してください。").min(0).max(50).default(0),
  duration: z.string().max(100).default(""),
  duration_days: z.union([z.literal(""), z.coerce.number().int().min(0).max(1000)]).default(""),
  materials: z.string().max(400).default(""),
  payment_terms: z.string().max(200).default(""),
  extra_costs: z.string().max(600).default(""),
  notes: z.string().max(2000).default(""),
  valid_until: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).default(""),
});

export async function submitQuoteAction(fd: FormData) {
  return handle(async () => {
    const { user } = await actionBusiness();
    const o = formObject(fd);
    let items: unknown = [];
    try {
      items = JSON.parse(o.items || "[]");
    } catch {
      throw new ActionError("工事項目の形式が正しくありません。");
    }
    const input = quoteSchema.parse({ ...o, items });
    const ctx = matchForUser(input.match_id, user);
    if (!ctx || ctx.side !== "company") throw new ActionError("案件が見つかりません。");
    const [pdf] = formFiles(fd, "pdf");
    const saved = pdf ? await saveUpload(pdf, { ownerUserId: user.id, scope: "match", scopeId: ctx.match.id, allow: ["pdf"] }) : null;
    const id = submitQuote(ctx, user.id, {
      ...input,
      duration_days: input.duration_days === "" ? null : input.duration_days,
      valid_until: input.valid_until || null,
      pdf_file_id: saved?.id ?? null,
    });
    revalidatePath("/business/quotes");
    return { quoteId: id, matchId: ctx.match.id };
  });
}
