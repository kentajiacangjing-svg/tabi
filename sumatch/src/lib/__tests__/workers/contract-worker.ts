// Runs in its own Node process (vite-node) against a shared STORAGE_DIR, to test what happens when separate
// server processes write at the same moment. Usage: vite-node contract-worker.ts -- <json>
import { matchForUser } from "../../access";
import { confirmContractDocument, agreeTerms } from "../../contract";
import { decideCompany } from "../../services";
import { get } from "../../db";
import type { User } from "../../types";

const arg = JSON.parse(process.argv[process.argv.length - 1]) as { op: string; matchId: string; userId: string; hash?: string; quoteId?: string; startAt: number };
const user = get<User>("SELECT * FROM users WHERE id = ?", arg.userId)!;
const ctx = matchForUser(arg.matchId, user)!;
// Everyone starts at the same wall-clock moment.
while (Date.now() < arg.startAt) {
  /* spin */
}
try {
  const r =
    arg.op === "confirm" ? confirmContractDocument(ctx, user.id, arg.hash!) : arg.op === "agree" ? agreeTerms(ctx, user.id, arg.hash!) : { id: decideCompany(ctx, { quoteId: arg.quoteId! }, user.id) };
  console.log("RESULT" + JSON.stringify({ ok: true, r }));
} catch (e) {
  console.log("RESULT" + JSON.stringify({ ok: false, error: String((e as Error).message) }));
}
