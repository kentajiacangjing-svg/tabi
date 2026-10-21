// Core business logic (writes). Server actions validate input + auth, then call these.
import { all, get, insert, newId, now, run, tx, update, parseJson } from "./db";
import { scoreCompany } from "./matching";
import { notify, companyUserIds } from "./notify";
import { publish } from "./realtime";
import { MAX_MATCHES_PER_PROJECT, PROJECT_STATUS } from "./constants";
import { calcQuote } from "./quote-calc";
import { demoVisibleSql } from "./demo";
import { detectContactInfo } from "./contact-detect";
import { appendContractEvent, assertNoContactInfo, contractForMatch, effectiveStage, latestQuoteForMatch, onQuoteRevised, termsLocked } from "./contract";
import type { Category, Company, Contract, Match, Plan, Project, ProjectStatus, Quote } from "./types";
import type { MatchContext } from "./access";

import { DomainError } from "./errors";
export { DomainError };

export function trackEvent(kind: string, userId?: string | null, sessionKey?: string | null, meta = "") {
  insert("events", { kind, user_id: userId ?? null, session_key: sessionKey ?? null, meta, created_at: now() });
}

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

export function generateCandidates(project: Project) {
  const category = get<Category>("SELECT * FROM categories WHERE id = ?", project.category_id);
  if (!category || !project.area_id) return [];
  const companies = all<Company & { works_count: number }>(
    `SELECT c.*, cc.works_count FROM companies c
       JOIN company_categories cc ON cc.company_id = c.id AND cc.category_id = ?
       JOIN company_areas ca ON ca.company_id = c.id AND ca.area_id = ?
      WHERE c.status = 'approved' AND ${demoVisibleSql("c.")}`,
    project.category_id,
    project.area_id,
  );
  const created: Match[] = [];
  for (const c of companies) {
    if (get("SELECT 1 FROM matches WHERE project_id = ? AND company_id = ?", project.id, c.id)) continue;
    const { score, reasons } = scoreCompany(
      {
        budget_min: project.budget_min,
        budget_max: project.budget_max,
        estimate_min: project.estimate_min,
        estimate_max: project.estimate_max,
        desired_timing: project.desired_timing,
        city: project.city,
        categoryName: category.name,
      },
      { ...c, worksInCategory: c.works_count },
    );
    const m: Match = {
      id: newId("mt"),
      project_id: project.id,
      company_id: c.id,
      score,
      reasons: JSON.stringify(reasons),
      customer_interest: 0,
      customer_interest_at: null,
      customer_saved: 0,
      customer_passed: 0,
      customer_match_seen_at: null,
      company_match_seen_at: null,
      company_response: "none",
      company_response_at: null,
      status: "candidate",
      matched_at: null,
      customer_last_read_at: null,
      company_last_read_at: null,
      last_message_at: null,
      created_at: now(),
    };
    insert("matches", { ...m });
    created.push(m);
  }
  return created;
}

export function notifyNewLeads(project: Project, matches: Match[]) {
  const cat = get<Category>("SELECT name FROM categories WHERE id = ?", project.category_id);
  for (const m of matches) {
    notify(
      companyUserIds(m.company_id),
      "new_lead",
      "新しい案件があります",
      [project.city, cat?.name, project.house_type].filter(Boolean).join("・"),
      `/business/leads/${project.id}`,
    );
  }
}

export function monthlyMatchUsage(companyId: string) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return (
    get<{ n: number }>("SELECT COUNT(*) AS n FROM matches WHERE company_id = ? AND matched_at >= ?", companyId, start.toISOString())?.n ?? 0
  );
}

export function matchLimitFor(company: Company) {
  const plan = company.plan_id ? get<Plan>("SELECT * FROM plans WHERE id = ?", company.plan_id) : undefined;
  if (plan) return plan.match_limit;
  return company.trial_ends_at && company.trial_ends_at > now() ? 10 : 0;
}

function activeCustomerRequests(projectId: string) {
  return (
    get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM matches WHERE project_id = ? AND customer_interest = 1 AND company_response != 'no'",
      projectId,
    )?.n ?? 0
  );
}

function becomeMatched(match: Match, project: Project, company: Company) {
  const ts = now();
  update("matches", match.id, { status: "matched", matched_at: ts, last_message_at: ts });
  insert("messages", {
    id: newId("msg"),
    match_id: match.id,
    sender_user_id: null,
    sender_side: "system",
    kind: "system",
    body: "マッチが成立しました。ここから先のご相談・現地調査の日程調整・見積のやり取りは、すべてSUMATCH内で行えます。",
    created_at: ts,
  });
  notify([project.customer_id], "match", "マッチしました", `${company.name}と相談を始められます。`, `/match/${match.id}`);
  notify(companyUserIds(company.id), "match", "マッチしました", `${project.city}のお客様と相談を始められます。`, `/business/match/${match.id}`);
}

/** Customer: 「この会社と話したい」 */
export function customerRequest(matchId: string, customerId: string) {
  return tx(() => {
    const match = get<Match>("SELECT * FROM matches WHERE id = ?", matchId);
    if (!match) throw new DomainError("候補が見つかりません。");
    const project = get<Project>("SELECT * FROM projects WHERE id = ?", match.project_id)!;
    if (project.customer_id !== customerId) throw new DomainError("この操作は許可されていません。");
    if (match.customer_interest) return match;
    if (match.company_response === "no") throw new DomainError("この会社は現在この案件に対応できません。");
    if (["contracted", "in_progress", "completed", "cancelled"].includes(project.status))
      throw new DomainError("この案件は既に会社が決定しています。");
    if (activeCustomerRequests(project.id) >= MAX_MATCHES_PER_PROJECT)
      throw new DomainError(`1つの相談で話せる会社は最大${MAX_MATCHES_PER_PROJECT}社までです。`);
    const company = get<Company>("SELECT * FROM companies WHERE id = ?", match.company_id)!;
    update("matches", match.id, { customer_interest: 1, customer_interest_at: now(), customer_passed: 0 });
    if (match.company_response === "yes") {
      becomeMatched(match, project, company);
    } else {
      notify(
        companyUserIds(company.id),
        "new_lead",
        "お客様があなたの会社と話したいと希望しています",
        `${project.city}・${project.title}。「対応したい」を押すとすぐにチャットが始まります。`,
        `/business/leads/${project.id}`,
      );
    }
    return get<Match>("SELECT * FROM matches WHERE id = ?", match.id)!;
  });
}

/** Customer: 「保存」 toggles a bookmark; 「見送る」 hides the company from the deck. */
export function customerMark(matchId: string, customerId: string, mark: "save" | "unsave" | "pass" | "unpass") {
  const match = get<Match>("SELECT * FROM matches WHERE id = ?", matchId);
  if (!match) throw new DomainError("候補が見つかりません。");
  const project = get<Project>("SELECT customer_id FROM projects WHERE id = ?", match.project_id);
  if (project?.customer_id !== customerId) throw new DomainError("この操作は許可されていません。");
  if (mark === "save") update("matches", match.id, { customer_saved: 1, customer_passed: 0 });
  if (mark === "unsave") update("matches", match.id, { customer_saved: 0 });
  if (mark === "pass") {
    if (match.status === "matched") throw new DomainError("マッチ済みの会社は見送れません。");
    update("matches", match.id, { customer_passed: 1, customer_saved: 0 });
  }
  if (mark === "unpass") update("matches", match.id, { customer_passed: 0 });
}

export function markMatchSeen(matchId: string, side: "customer" | "company") {
  run(`UPDATE matches SET ${side === "customer" ? "customer_match_seen_at" : "company_match_seen_at"} = COALESCE(${side === "customer" ? "customer_match_seen_at" : "company_match_seen_at"}, ?) WHERE id = ?`, now(), matchId);
}

/** Customer: withdraw a pending request (not possible once matched). */
export function customerWithdraw(matchId: string, customerId: string) {
  const match = get<Match>("SELECT * FROM matches WHERE id = ?", matchId);
  if (!match) throw new DomainError("候補が見つかりません。");
  const project = get<Project>("SELECT customer_id FROM projects WHERE id = ?", match.project_id);
  if (project?.customer_id !== customerId) throw new DomainError("この操作は許可されていません。");
  if (match.status === "matched") throw new DomainError("マッチ成立後は取り消せません。");
  update("matches", match.id, { customer_interest: 0, customer_interest_at: null });
}

/** Company: 「対応したい」 / 「見送る」 */
export function companyRespond(projectId: string, companyId: string, yes: boolean) {
  return tx(() => {
    const match = get<Match>("SELECT * FROM matches WHERE project_id = ? AND company_id = ?", projectId, companyId);
    if (!match) throw new DomainError("案件が見つかりません。");
    if (match.status === "matched") return match;
    const company = get<Company>("SELECT * FROM companies WHERE id = ?", companyId)!;
    if (company.status !== "approved") throw new DomainError("企業審査の完了後に案件へ対応できます。");
    const project = get<Project>("SELECT * FROM projects WHERE id = ?", projectId)!;
    if (["contracted", "in_progress", "completed", "cancelled"].includes(project.status))
      throw new DomainError("この案件は既に受付を終了しています。");
    if (yes && match.customer_interest) {
      const limit = matchLimitFor(company);
      if (monthlyMatchUsage(companyId) >= limit)
        throw new DomainError(`今月のマッチ上限（${limit}件）に達しています。プランの変更をご検討ください。`);
    }
    update("matches", match.id, { company_response: yes ? "yes" : "no", company_response_at: now() });
    if (yes && match.customer_interest) {
      becomeMatched(match, project, company);
    } else if (yes) {
      notify(
        [project.customer_id],
        "match",
        "対応を希望している会社があります",
        `${company.name}があなたの相談に対応したいと希望しています。`,
        `/matches?project=${project.id}`,
      );
    } else if (match.customer_interest) {
      notify(
        [project.customer_id],
        "match",
        "会社から返答がありました",
        `${company.name}は今回の相談に対応が難しいとのことです。他の候補から選び直せます。`,
        `/matches?project=${project.id}`,
      );
    }
    return get<Match>("SELECT * FROM matches WHERE id = ?", match.id)!;
  });
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

export function participantsOf(ctx: { match: Match; project: Project }) {
  return { customer: [ctx.project.customer_id], company: companyUserIds(ctx.match.company_id) };
}

export function postMessage(
  ctx: MatchContext,
  senderUserId: string,
  input: { kind: "text" | "image" | "file" | "quote"; body: string; fileId?: string | null; quoteId?: string | null },
) {
  if (ctx.side === "admin") throw new DomainError("運営はメッセージを送信できません。");
  if (ctx.match.status !== "matched") throw new DomainError("マッチ成立後にメッセージを送れます。");
  // Before both sides agree the contract terms, contact details are refused here (not just warned in the
  // browser), so a modified client or a direct request can't get them through.
  if (input.kind !== "quote") assertNoContactInfo(ctx, senderUserId, [input.body], "message");
  const flags = input.kind === "quote" ? [] : detectContactInfo(input.body);
  const ts = now();
  const id = newId("msg");
  insert("messages", {
    id,
    match_id: ctx.match.id,
    sender_user_id: senderUserId,
    sender_side: ctx.side,
    kind: input.kind,
    body: input.body,
    file_id: input.fileId ?? null,
    quote_id: input.quoteId ?? null,
    contact_flags: flags.join(","),
    created_at: ts,
  });
  const readCol = ctx.side === "customer" ? "customer_last_read_at" : "company_last_read_at";
  run(`UPDATE matches SET last_message_at = ?, ${readCol} = ? WHERE id = ?`, ts, ts, ctx.match.id);

  const p = participantsOf(ctx);
  publish([...p.customer, ...p.company], { type: "message", matchId: ctx.match.id });
  const recipients = ctx.side === "customer" ? p.company : p.customer;
  const link = ctx.side === "customer" ? `/business/messages/${ctx.match.id}` : `/messages/${ctx.match.id}`;
  const preview = input.kind === "text" ? input.body.slice(0, 40) : input.kind === "quote" ? "見積書が届きました" : "ファイルが届きました";
  notify(recipients, "message", ctx.side === "customer" ? "お客様からメッセージがあります" : `${ctx.company.name}からメッセージがあります`, preview, link);
  return { id, flags };
}

export function markRead(ctx: MatchContext) {
  if (ctx.side === "admin") return;
  const col = ctx.side === "customer" ? "customer_last_read_at" : "company_last_read_at";
  run(`UPDATE matches SET ${col} = ? WHERE id = ?`, now(), ctx.match.id);
  const p = participantsOf(ctx);
  publish(ctx.side === "customer" ? p.company : p.customer, { type: "read", matchId: ctx.match.id });
}

/* ------------------------------------------------------------------ */
/* Quotes                                                              */
/* ------------------------------------------------------------------ */

export interface QuoteInput {
  title: string;
  items: { name: string; quantity: number; unit: string; unit_price: number }[];
  overhead: number;
  discount: number;
  warranty: string;
  warranty_years: number;
  duration: string;
  duration_days: number | null;
  materials: string;
  payment_terms: string;
  extra_costs: string;
  notes: string;
  valid_until: string | null;
  pdf_file_id: string | null;
}

export { calcQuote };

export function submitQuote(ctx: MatchContext, userId: string, input: QuoteInput) {
  if (ctx.side !== "company") throw new DomainError("見積は企業のみ提出できます。");
  if (ctx.match.status !== "matched") throw new DomainError("マッチ成立後に見積を提出できます。");
  // After the customer chose a company, only that company may still revise — and only until both sides
  // have agreed the terms. A revision sends both back to confirm.
  const chosen = contractForMatch(ctx.match.id);
  if (chosen ? termsLocked(chosen) : ["contracted", "in_progress", "completed", "cancelled"].includes(ctx.project.status))
    throw new DomainError(chosen ? "双方の合意が確認済みのため、見積は変更できません。" : "この案件は既に依頼先が決定しています。");
  assertNoContactInfo(ctx, userId, [input.title, input.warranty, input.duration, input.materials, input.payment_terms, input.extra_costs, input.notes, ...input.items.map((i) => i.name)], "quote");
  return tx(() => {
    const prev = get<Quote>(
      "SELECT * FROM quotes WHERE match_id = ? AND status IN ('submitted','accepted') ORDER BY version DESC LIMIT 1",
      ctx.match.id,
    );
    if (prev) update("quotes", prev.id, { status: "superseded" });
    const { lines, subtotal, tax, total } = calcQuote(input.items, input.overhead, input.discount);
    const id = newId("qt");
    insert("quotes", {
      id,
      match_id: ctx.match.id,
      project_id: ctx.project.id,
      company_id: ctx.company.id,
      created_by: userId,
      version: (prev?.version ?? 0) + 1,
      status: chosen ? "accepted" : "submitted",
      title: input.title,
      subtotal,
      overhead: input.overhead,
      discount: input.discount,
      tax,
      total,
      warranty: input.warranty,
      warranty_years: input.warranty_years,
      duration: input.duration,
      duration_days: input.duration_days,
      materials: input.materials,
      payment_terms: input.payment_terms,
      extra_costs: input.extra_costs,
      notes: input.notes,
      valid_until: input.valid_until,
      pdf_file_id: input.pdf_file_id,
      created_at: now(),
    });
    lines.forEach((l, i) =>
      insert("quote_items", { id: newId("qi"), quote_id: id, name: l.name, quantity: l.quantity, unit: l.unit, unit_price: l.unit_price, amount: l.amount, sort: i }),
    );
    postMessage(ctx, userId, { kind: "quote", body: prev ? `見積書を更新しました（第${(prev.version ?? 0) + 1}版）` : "見積書を提出しました", quoteId: id, fileId: input.pdf_file_id });
    refreshProjectStatus(ctx.project.id);
    if (chosen) {
      onQuoteRevised(chosen, get<Quote>("SELECT * FROM quotes WHERE id = ?", id)!, userId);
      notify([ctx.project.customer_id], "quote", "見積が改訂されました", `${ctx.company.name}の見積が税込${total.toLocaleString("ja-JP")}円に改訂されました。契約条件をもう一度確認してください。`, `/projects/${ctx.project.id}`);
    } else {
      notify([ctx.project.customer_id], "quote", "見積が届きました", `${ctx.company.name}から見積（税込${Math.round(total / 10000)}万円）が届きました。`, `/quotes?project=${ctx.project.id}`);
    }
    return id;
  });
}

/** 相談中 → 見積中 → 比較中 is derived from the number of companies that submitted quotes. */
export function refreshProjectStatus(projectId: string) {
  const p = get<Project>("SELECT status FROM projects WHERE id = ?", projectId);
  if (!p || !["consulting", "quoting", "comparing"].includes(p.status)) return;
  const n = get<{ n: number }>("SELECT COUNT(DISTINCT company_id) AS n FROM quotes WHERE project_id = ? AND status = 'submitted'", projectId)?.n ?? 0;
  const status: ProjectStatus = n >= 2 ? "comparing" : n === 1 ? "quoting" : "consulting";
  if (status !== p.status) update("projects", projectId, { status, updated_at: now() });
}

/* ------------------------------------------------------------------ */
/* Contract                                                            */
/* ------------------------------------------------------------------ */

/**
 * The customer chooses which company to ask (依頼先決定). This is NOT a contract: the terms are written by the
 * company and agreed by both sides afterwards (see lib/contract.ts). The quote must be the company's latest
 * version and the amount is always taken from it, never from the request. Repeating the same choice is a
 * no-op, so a double tap or a retried request can't create two records.
 */
export function decideCompany(ctx: MatchContext, input: { quoteId: string }, userId: string) {
  // One write transaction: the checks below and the writes cannot interleave with another process.
  return tx(() => {
    if (ctx.side !== "customer") throw new DomainError("依頼先の決定はお客様のみ行えます。");
    if (ctx.match.status !== "matched") throw new DomainError("マッチ済みの会社のみ選べます。");
    const existing = get<Contract>("SELECT * FROM contracts WHERE project_id = ?", ctx.project.id);
    if (existing) {
      if (existing.match_id === ctx.match.id && existing.quote_id === input.quoteId) return existing.id;
      throw new DomainError("この相談は既に依頼先が決まっています。");
    }
    const latest = latestQuoteForMatch(ctx.match.id);
    if (!latest) throw new DomainError("見積が届いてから依頼先を決められます。");
    if (latest.id !== input.quoteId) throw new DomainError("この見積は更新されています。最新の見積を確認してから決めてください。");
    if (latest.valid_until && latest.valid_until < now().slice(0, 10)) throw new DomainError("この見積は有効期限を過ぎています。会社に再提出を依頼してください。");
    const plan = ctx.company.plan_id ? get<Plan>("SELECT * FROM plans WHERE id = ?", ctx.company.plan_id) : undefined;
    const amount = latest.total;
    return tx(() => {
      const id = newId("ct");
      const ts = now();
      insert("contracts", {
        id,
        project_id: ctx.project.id,
        company_id: ctx.company.id,
        match_id: ctx.match.id,
        quote_id: latest.id,
        amount,
        contract_date: null,
        start_date: null,
        contract_file_id: null,
        status: "contracted",
        stage: "selected",
        success_fee_rate: plan?.success_fee_rate ?? 0.03,
        notes: "",
        created_at: ts,
        updated_at: ts,
      });
      appendContractEvent(id, "customer", userId, "selected", "", `${latest.id} v${latest.version} ${amount}`);
      update("quotes", latest.id, { status: "accepted" });
      run("UPDATE quotes SET status = 'declined' WHERE project_id = ? AND status = 'submitted' AND id != ?", ctx.project.id, latest.id);
      update("projects", ctx.project.id, { status: "contracted", updated_at: ts });
      insert("messages", {
        id: newId("msg"),
        match_id: ctx.match.id,
        sender_side: "system",
        kind: "system",
        body: `お客様が依頼先として${ctx.company.name}を選びました（見積 第${latest.version}版・税込${amount.toLocaleString("ja-JP")}円）。契約条件はこれから確認します。`,
        created_at: ts,
      });
      run("UPDATE matches SET last_message_at = ? WHERE id = ?", ts, ctx.match.id);
      notify(companyUserIds(ctx.company.id), "contract", "依頼先に選ばれました", `${ctx.project.city}・${ctx.project.title}。契約条件を入力してください。`, `/business/contract/${id}`);
      // Politely close the other conversations.
      const others = all<Match>("SELECT * FROM matches WHERE project_id = ? AND id != ? AND status = 'matched'", ctx.project.id, ctx.match.id);
      for (const o of others) {
        insert("messages", {
          id: newId("msg"),
          match_id: o.id,
          sender_side: "system",
          kind: "system",
          body: "お客様は今回、別の会社に依頼することを決定しました。ご対応ありがとうございました。",
          created_at: ts,
        });
        notify(companyUserIds(o.company_id), "contract", "案件の結果のお知らせ", `${ctx.project.city}の案件は他社に決定しました。`, `/business/messages/${o.id}`);
      }
      run("UPDATE matches SET status = 'closed' WHERE project_id = ? AND status = 'candidate'", ctx.project.id);
      publish([ctx.project.customer_id, ...companyUserIds(ctx.company.id)], { type: "message", matchId: ctx.match.id });
      return id;
    });
  });
}

export function advanceContract(given: Contract, to: "in_progress" | "completed", actorLabel: string) {
  return tx(() => advanceContractLocked(get<Contract>("SELECT * FROM contracts WHERE id = ?", given.id)!, to, actorLabel));
}

function advanceContractLocked(contract: Contract, to: "in_progress" | "completed", actorLabel: string) {
  const order = ["contracted", "in_progress", "completed"];
  if (order.indexOf(to) <= order.indexOf(contract.status)) throw new DomainError("ステータスを戻すことはできません。");
  // Work starts only at 契約成立; finishing needs work that has started (including work started before this rule).
  if (to === "in_progress" && effectiveStage(contract) !== "contracted") throw new DomainError("契約成立の要件（契約書の登録と双方の確認）を満たしてから、工事を開始できます。");
  if (to === "completed" && contract.status !== "in_progress") throw new DomainError("工事が始まってから完了にできます。");
  const ts = now();
  update("contracts", contract.id, { status: to, updated_at: ts, ...(to === "completed" ? { end_date: ts.slice(0, 10) } : {}) });
  appendContractEvent(contract.id, "system", null, to === "in_progress" ? "work_started" : "work_completed", contract.terms_hash, actorLabel);
  update("projects", contract.project_id, { status: to, updated_at: ts });
  insert("messages", {
    id: newId("msg"),
    match_id: contract.match_id,
    sender_side: "system",
    kind: "system",
    body: `${actorLabel}がステータスを「${PROJECT_STATUS[to].label}」に更新しました。`,
    created_at: ts,
  });
  const project = get<Project>("SELECT * FROM projects WHERE id = ?", contract.project_id)!;
  publish([project.customer_id, ...companyUserIds(contract.company_id)], { type: "message", matchId: contract.match_id });
  if (to === "completed") {
    notify([project.customer_id], "contract", "工事が完了しました", "よろしければ口コミを投稿してください。今後のお客様の参考になります。", `/projects/${project.id}`);
  }
}

export function recalcCompanyRating(companyId: string) {
  const r = get<{ avg: number | null; n: number }>("SELECT AVG(rating) AS avg, COUNT(*) AS n FROM reviews WHERE company_id = ?", companyId);
  update("companies", companyId, { rating_avg: Math.round((r?.avg ?? 0) * 10) / 10, review_count: r?.n ?? 0 });
}

export function reasonsOf(m: Pick<Match, "reasons">) {
  return parseJson<string[]>(m.reasons, []);
}
