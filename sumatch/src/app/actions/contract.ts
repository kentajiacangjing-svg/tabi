"use server";

import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { get } from "@/lib/db";
import { readStoredFile, saveUpload } from "@/lib/files";
import { ActionError, actionUser } from "@/lib/auth";
import { formObject, handle } from "@/lib/action";
import { matchForUser } from "@/lib/access";
import { agreeTerms, attachContractDocument, confirmContractDocument, effectiveStage, saveContractContact, saveTerms, type TermsInput } from "@/lib/contract";
import { TERM_FIELDS } from "@/lib/contract-terms";
import type { Contract } from "@/lib/types";

/** Contract by id, only for its customer or a member of its company. */
async function contractCtx(contractId: string, roles: ("customer" | "business")[]) {
  const user = await actionUser(roles);
  const c = get<Contract>("SELECT * FROM contracts WHERE id = ?", contractId);
  const ctx = c ? matchForUser(c.match_id, user) : null;
  if (!c || !ctx || ctx.side === "admin") throw new ActionError("この操作は許可されていません。");
  return { user, c, ctx };
}

/** The company writes the terms (all fields required; the amount is taken from the quote on the server). */
export async function saveTermsAction(contractId: string, fd: FormData) {
  return handle(async () => {
    const { user, c, ctx } = await contractCtx(contractId, ["business"]);
    const o = formObject(fd);
    const input = Object.fromEntries(TERM_FIELDS.map((f) => [f.key, o[f.key] ?? ""])) as TermsInput;
    const r = saveTerms(ctx, user.id, input);
    revalidatePath(`/business/contract/${c.id}`);
    revalidatePath(`/projects/${c.project_id}`);
    return r;
  });
}

/** Either side agrees to the exact terms version it was shown. */
export async function agreeTermsAction(contractId: string, shownHash: string) {
  return handle(async () => {
    const { user, c, ctx } = await contractCtx(contractId, ["customer", "business"]);
    const r = agreeTerms(ctx, user.id, shownHash);
    revalidatePath(`/business/contract/${c.id}`);
    revalidatePath(`/projects/${c.project_id}`);
    return r;
  });
}

/** The company registers its contract document (工事請負契約書). The file's hash is what both sides confirm. */
export async function uploadContractFileAction(contractId: string, fd: FormData) {
  return handle(async () => {
    const { user, c, ctx } = await contractCtx(contractId, ["business"]);
    const f = fd.get("contract_file");
    if (!(f instanceof File) || f.size === 0) throw new ActionError("ファイルを選んでください。");
    // Check the stage before storing anything.
    if (effectiveStage(c) !== "agreed") throw new ActionError(effectiveStage(c) === "contracted" ? "契約成立後は契約書を差し替えられません。" : "契約書は、契約条件に双方が同意してから登録できます。");
    const file = await saveUpload(f, { ownerUserId: user.id, scope: "contract", scopeId: c.id, allow: ["pdf", "image"] });
    const sha256 = createHash("sha256").update(readStoredFile(file)).digest("hex");
    attachContractDocument(ctx, user.id, { id: file.id, sha256 });
    revalidatePath(`/business/contract/${c.id}`);
    revalidatePath(`/projects/${c.project_id}`);
    return {};
  });
}

/** Either side confirms the exact contract document it was shown. */
export async function confirmContractDocumentAction(contractId: string, shownFileHash: string) {
  return handle(async () => {
    const { user, c, ctx } = await contractCtx(contractId, ["customer", "business"]);
    const r = confirmContractDocument(ctx, user.id, shownFileHash);
    revalidatePath(`/business/contract/${c.id}`);
    revalidatePath(`/projects/${c.project_id}`);
    return r;
  });
}

/** Each side's own contact details, after 契約成立 only. */
export async function saveContractContactAction(contractId: string, fd: FormData) {
  return handle(async () => {
    const { user, c, ctx } = await contractCtx(contractId, ["customer", "business"]);
    const o = formObject(fd);
    saveContractContact(ctx, user.id, { name: o.name ?? "", phone: o.phone ?? "", email: o.email ?? "", address: o.address ?? "", hours: o.hours ?? "" });
    revalidatePath(`/business/contract/${c.id}`);
    revalidatePath(`/projects/${c.project_id}`);
    return {};
  });
}
