"use server";

import { revalidatePath } from "next/cache";
import { get, now, update } from "@/lib/db";
import { saveUpload } from "@/lib/files";
import { ActionError, actionUser } from "@/lib/auth";
import { formObject, handle } from "@/lib/action";
import { matchForUser } from "@/lib/access";
import { agreeTerms, appendContractEvent, effectiveStage, saveTerms, type TermsInput } from "@/lib/contract";
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

/** The company attaches its own contract document (工事請負契約書) once both sides have agreed the terms. */
export async function uploadContractFileAction(contractId: string, fd: FormData) {
  return handle(async () => {
    const { user, c } = await contractCtx(contractId, ["business"]);
    if (effectiveStage(c) !== "agreed") throw new ActionError("契約書は、双方の合意が確認できてから添付できます。");
    const f = fd.get("contract_file");
    if (!(f instanceof File) || f.size === 0) throw new ActionError("ファイルを選んでください。");
    const file = await saveUpload(f, { ownerUserId: user.id, scope: "contract", scopeId: c.id, allow: ["pdf", "image"] });
    update("contracts", c.id, { contract_file_id: file.id, updated_at: now() });
    appendContractEvent(c.id, "company", user.id, "document_attached", c.terms_hash, file.id);
    revalidatePath(`/business/contract/${c.id}`);
    revalidatePath(`/projects/${c.project_id}`);
    return {};
  });
}
