"use server";

import { revalidatePath } from "next/cache";
import { ActionError, actionUser } from "@/lib/auth";
import { formObject, handle } from "@/lib/action";
import { matchForUser } from "@/lib/access";
import { approveVisit, closeVisit, proposeVisit } from "@/lib/visits";

async function visitCtx(matchId: string, roles: ("customer" | "business")[]) {
  const user = await actionUser(roles);
  const ctx = matchForUser(matchId, user);
  if (!ctx || ctx.side === "admin") throw new ActionError("この操作は許可されていません。");
  return { user, ctx };
}

function revalidate(matchId: string) {
  revalidatePath(`/messages/${matchId}/visit`);
  revalidatePath(`/business/messages/${matchId}/visit`);
}

export async function proposeVisitAction(matchId: string, fd: FormData) {
  return handle(async () => {
    const { user, ctx } = await visitCtx(matchId, ["business"]);
    const o = formObject(fd);
    const id = proposeVisit(ctx, user.id, { slots: fd.getAll("slot").map(String), note: o.note ?? "" });
    revalidate(matchId);
    return { id };
  });
}

export async function approveVisitAction(matchId: string, fd: FormData) {
  return handle(async () => {
    const { user, ctx } = await visitCtx(matchId, ["customer"]);
    const o = formObject(fd);
    const r = approveVisit(ctx, user.id, { visitId: o.visit_id ?? "", slot: o.slot ?? "", address: o.address ?? "", accessNote: o.access_note ?? "", consent: o.consent === "yes" });
    revalidate(matchId);
    return r;
  });
}

export async function closeVisitAction(matchId: string, visitId: string) {
  return handle(async () => {
    const { user, ctx } = await visitCtx(matchId, ["customer", "business"]);
    closeVisit(ctx, user.id, visitId);
    revalidate(matchId);
    return {};
  });
}
