// Row-level access control. Every read/write of a project, match or file goes through here.
import { get } from "./db";
import type { Company, Contract, FileRow, Match, Project, User } from "./types";

export function companyIdFor(userId: string): string | null {
  return get<{ company_id: string }>("SELECT company_id FROM company_members WHERE user_id = ? LIMIT 1", userId)?.company_id ?? null;
}

export function projectForCustomer(projectId: string, user: User): Project | null {
  const p = get<Project>("SELECT * FROM projects WHERE id = ?", projectId);
  if (!p) return null;
  if (user.role === "admin" || p.customer_id === user.id) return p;
  return null;
}

/** A company may see a project only if it was offered to it as a lead. */
export function projectForCompany(projectId: string, companyId: string): { project: Project; match: Match } | null {
  const match = get<Match>("SELECT * FROM matches WHERE project_id = ? AND company_id = ?", projectId, companyId);
  if (!match) return null;
  const project = get<Project>("SELECT * FROM projects WHERE id = ?", projectId);
  return project ? { project, match } : null;
}

export interface MatchContext {
  match: Match;
  project: Project;
  company: Company;
  side: "customer" | "company" | "admin";
}

export function matchForUser(matchId: string, user: User): MatchContext | null {
  const match = get<Match>("SELECT * FROM matches WHERE id = ?", matchId);
  if (!match) return null;
  const project = get<Project>("SELECT * FROM projects WHERE id = ?", match.project_id);
  const company = get<Company>("SELECT * FROM companies WHERE id = ?", match.company_id);
  if (!project || !company) return null;
  if (user.role === "admin") return { match, project, company, side: "admin" };
  if (user.role === "customer" && project.customer_id === user.id) return { match, project, company, side: "customer" };
  if (user.role === "business" && companyIdFor(user.id) === match.company_id) return { match, project, company, side: "company" };
  return null;
}

export function canReadFile(user: User | null, file: FileRow): boolean {
  if (file.scope === "public") return true;
  if (!user) return false;
  if (user.role === "admin") return true;
  if (file.owner_user_id === user.id) return true;
  if (!file.scope_id) return false;
  if (file.scope === "project") {
    const p = get<Project>("SELECT * FROM projects WHERE id = ?", file.scope_id);
    if (!p) return false;
    if (p.customer_id === user.id) return true;
    const cid = companyIdFor(user.id);
    return !!cid && !!projectForCompany(p.id, cid);
  }
  if (file.scope === "match") {
    const ctx = matchForUser(file.scope_id, user);
    return !!ctx && ctx.match.status === "matched";
  }
  if (file.scope === "contract") {
    const c = get<Contract>("SELECT * FROM contracts WHERE id = ?", file.scope_id);
    if (!c) return false;
    const p = get<Project>("SELECT customer_id FROM projects WHERE id = ?", c.project_id);
    return p?.customer_id === user.id || companyIdFor(user.id) === c.company_id;
  }
  return false;
}
