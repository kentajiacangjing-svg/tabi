// Read models for pages. Callers must have performed access checks (see access.ts).
import { all, get, parseJson } from "./db";
import { fileUrl } from "./urls";
import type { Area, Category, Company, CompanyWork, Contract, Match, Project, Quote, QuoteItem, Review } from "./types";

export const activeCategories = () => all<Category>("SELECT * FROM categories WHERE active = 1 ORDER BY sort, name");
export const allCategories = () => all<Category>("SELECT * FROM categories ORDER BY sort, name");
export const activeAreas = () => all<Area>("SELECT * FROM service_areas WHERE active = 1 ORDER BY sort, city");
export const allAreas = () => all<Area>("SELECT * FROM service_areas ORDER BY sort, city");

export function getSetting(key: string, fallback = "") {
  return get<{ value: string }>("SELECT value FROM settings WHERE key = ?", key)?.value ?? fallback;
}

export interface ProjectListItem extends Project {
  category_name: string;
  category_icon: string;
  cover_file_id: string | null;
  photo_count: number;
  matched_count: number;
  requested_count: number;
  quote_count: number;
  unread: number;
}

export function projectsForCustomer(customerId: string) {
  return all<ProjectListItem>(
    `SELECT p.*, c.name AS category_name, c.icon AS category_icon,
       (SELECT file_id FROM project_images i WHERE i.project_id = p.id ORDER BY sort LIMIT 1) AS cover_file_id,
       (SELECT COUNT(*) FROM project_images i WHERE i.project_id = p.id) AS photo_count,
       (SELECT COUNT(*) FROM matches m WHERE m.project_id = p.id AND m.status = 'matched') AS matched_count,
       (SELECT COUNT(*) FROM matches m WHERE m.project_id = p.id AND m.customer_interest = 1 AND m.company_response != 'no') AS requested_count,
       (SELECT COUNT(*) FROM quotes q WHERE q.project_id = p.id AND q.status IN ('submitted','accepted')) AS quote_count,
       (SELECT COUNT(*) FROM messages g JOIN matches m ON m.id = g.match_id
          WHERE m.project_id = p.id AND m.status = 'matched' AND g.sender_side = 'company'
            AND g.created_at > COALESCE(m.customer_last_read_at, '')) AS unread
     FROM projects p JOIN categories c ON c.id = p.category_id
     WHERE p.customer_id = ? ORDER BY p.updated_at DESC`,
    customerId,
  );
}

export function projectImages(projectId: string) {
  return all<{ file_id: string }>("SELECT file_id FROM project_images WHERE project_id = ? ORDER BY sort", projectId).map((r) => r.file_id);
}

export interface CandidateRow extends Match {
  company: Company;
  works_in_category: number;
  cover_image: string | null;
}

export function candidatesForProject(projectId: string): CandidateRow[] {
  const rows = all<Match & { works_in_category: number }>(
    `SELECT m.*, COALESCE(cc.works_count, 0) AS works_in_category
       FROM matches m
       JOIN projects p ON p.id = m.project_id
       JOIN companies co ON co.id = m.company_id
       LEFT JOIN company_categories cc ON cc.company_id = m.company_id AND cc.category_id = p.category_id
      WHERE m.project_id = ? AND co.status = 'approved'
      ORDER BY (m.status = 'matched') DESC, m.customer_interest DESC, m.score DESC`,
    projectId,
  );
  const project = get<Project>("SELECT category_id FROM projects WHERE id = ?", projectId);
  return rows.map((r) => {
    const w = get<{ image_url: string | null; file_id: string | null }>(
      "SELECT image_url, file_id FROM company_works WHERE company_id = ? ORDER BY (category_id = ?) DESC, created_at DESC LIMIT 1",
      r.company_id,
      project?.category_id ?? "",
    );
    return { ...r, company: get<Company>("SELECT * FROM companies WHERE id = ?", r.company_id)!, cover_image: workImage(w) };
  });
}

export function workImage(w: { image_url: string | null; file_id: string | null } | undefined | null) {
  if (!w) return null;
  return w.image_url ?? fileUrl(w.file_id);
}

export interface Conversation {
  match_id: string;
  project_id: string;
  project_title: string;
  project_city: string;
  project_status: Project["status"];
  company_id: string;
  company_name: string;
  company_color: string;
  company_logo: string | null;
  customer_name: string;
  last_message: string | null;
  last_kind: string | null;
  last_at: string | null;
  unread: number;
}

function conversations(where: string, side: "customer" | "company", param: string) {
  const readCol = side === "customer" ? "customer_last_read_at" : "company_last_read_at";
  const other = side === "customer" ? "company" : "customer";
  return all<Conversation>(
    `SELECT m.id AS match_id, p.id AS project_id, p.title AS project_title, p.city AS project_city, p.status AS project_status,
            co.id AS company_id, co.name AS company_name, co.brand_color AS company_color, co.logo_file_id AS company_logo,
            u.name AS customer_name,
            (SELECT body FROM messages g WHERE g.match_id = m.id ORDER BY created_at DESC LIMIT 1) AS last_message,
            (SELECT kind FROM messages g WHERE g.match_id = m.id ORDER BY created_at DESC LIMIT 1) AS last_kind,
            m.last_message_at AS last_at,
            (SELECT COUNT(*) FROM messages g WHERE g.match_id = m.id AND g.sender_side = '${other}' AND g.created_at > COALESCE(m.${readCol}, '')) AS unread
       FROM matches m
       JOIN projects p ON p.id = m.project_id
       JOIN companies co ON co.id = m.company_id
       JOIN users u ON u.id = p.customer_id
      WHERE m.status = 'matched' AND ${where}
      ORDER BY m.last_message_at DESC`,
    param,
  );
}

export const conversationsForCustomer = (userId: string) => conversations("p.customer_id = ?", "customer", userId);
export const conversationsForCompany = (companyId: string) => conversations("m.company_id = ?", "company", companyId);

export interface ChatMessage {
  id: string;
  sender_side: "customer" | "company" | "system";
  sender_name: string | null;
  kind: "text" | "image" | "file" | "quote" | "system";
  body: string;
  file_id: string | null;
  file_mime: string | null;
  file_name: string | null;
  quote_id: string | null;
  quote_total: number | null;
  quote_title: string | null;
  quote_version: number | null;
  contact_flags: string;
  created_at: string;
}

export function messagesFor(matchId: string) {
  return all<ChatMessage>(
    `SELECT g.id, g.sender_side, u.name AS sender_name, g.kind, g.body, g.file_id, f.mime AS file_mime, f.original_name AS file_name,
            g.quote_id, q.total AS quote_total, q.title AS quote_title, q.version AS quote_version, g.contact_flags, g.created_at
       FROM messages g
       LEFT JOIN users u ON u.id = g.sender_user_id
       LEFT JOIN files f ON f.id = g.file_id
       LEFT JOIN quotes q ON q.id = g.quote_id
      WHERE g.match_id = ? ORDER BY g.created_at`,
    matchId,
  );
}

export interface QuoteWithItems extends Quote {
  items: QuoteItem[];
  company: Company;
}

export function quoteWithItems(q: Quote): QuoteWithItems {
  return {
    ...q,
    items: all<QuoteItem>("SELECT * FROM quote_items WHERE quote_id = ? ORDER BY sort", q.id),
    company: get<Company>("SELECT * FROM companies WHERE id = ?", q.company_id)!,
  };
}

/** Latest live quote per company for a project. */
export function latestQuotesForProject(projectId: string): QuoteWithItems[] {
  const qs = all<Quote>(
    `SELECT q.* FROM quotes q
      WHERE q.project_id = ? AND q.status IN ('submitted','accepted','declined')
        AND q.version = (SELECT MAX(version) FROM quotes x WHERE x.match_id = q.match_id AND x.status != 'superseded')
      ORDER BY q.total`,
    projectId,
  );
  return qs.map(quoteWithItems);
}

export function contractForProject(projectId: string) {
  return get<Contract>("SELECT * FROM contracts WHERE project_id = ?", projectId) ?? null;
}

export interface CompanyProfile {
  company: Company;
  categories: (Category & { works_count: number })[];
  areas: Area[];
  works: CompanyWork[];
  reviews: Review[];
}

export function companyProfile(id: string): CompanyProfile | null {
  const company = get<Company>("SELECT * FROM companies WHERE id = ?", id);
  if (!company) return null;
  return {
    company,
    categories: all<Category & { works_count: number }>(
      "SELECT c.*, cc.works_count FROM company_categories cc JOIN categories c ON c.id = cc.category_id WHERE cc.company_id = ? ORDER BY c.sort",
      id,
    ),
    areas: all<Area>("SELECT a.* FROM company_areas ca JOIN service_areas a ON a.id = ca.area_id WHERE ca.company_id = ? ORDER BY a.sort", id),
    works: all<CompanyWork>("SELECT * FROM company_works WHERE company_id = ? ORDER BY created_at DESC", id),
    reviews: all<Review>("SELECT * FROM reviews WHERE company_id = ? ORDER BY created_at DESC LIMIT 20", id),
  };
}

export interface LeadRow {
  match_id: string;
  project_id: string;
  title: string;
  city: string;
  house_type: string;
  building_age: number | null;
  category_name: string;
  concerns: string;
  desired_timing: string;
  budget_min: number | null;
  budget_max: number | null;
  photo_count: number;
  score: number;
  reasons: string;
  customer_interest: number;
  company_response: "none" | "yes" | "no";
  match_status: Match["status"];
  project_status: Project["status"];
  created_at: string;
}

export function leadsForCompany(companyId: string) {
  return all<LeadRow>(
    `SELECT m.id AS match_id, p.id AS project_id, p.title, p.city, p.house_type, p.building_age, c.name AS category_name, p.concerns,
            p.desired_timing, p.budget_min, p.budget_max,
            (SELECT COUNT(*) FROM project_images i WHERE i.project_id = p.id) AS photo_count,
            m.score, m.reasons, m.customer_interest, m.company_response, m.status AS match_status, p.status AS project_status, p.created_at
       FROM matches m JOIN projects p ON p.id = m.project_id JOIN categories c ON c.id = p.category_id
      WHERE m.company_id = ?
      ORDER BY m.customer_interest DESC, p.created_at DESC`,
    companyId,
  );
}

export function reasons(m: { reasons: string }) {
  return parseJson<string[]>(m.reasons, []);
}

export function unreadNotificationCount(userId: string) {
  return get<{ n: number }>("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL", userId)?.n ?? 0;
}

export function unreadMessageCount(userId: string, role: string, companyId: string | null) {
  if (role === "customer") {
    return (
      get<{ n: number }>(
        `SELECT COUNT(*) AS n FROM messages g JOIN matches m ON m.id = g.match_id JOIN projects p ON p.id = m.project_id
          WHERE p.customer_id = ? AND m.status = 'matched' AND g.sender_side = 'company' AND g.created_at > COALESCE(m.customer_last_read_at, '')`,
        userId,
      )?.n ?? 0
    );
  }
  if (role === "business" && companyId) {
    return (
      get<{ n: number }>(
        `SELECT COUNT(*) AS n FROM messages g JOIN matches m ON m.id = g.match_id
          WHERE m.company_id = ? AND m.status = 'matched' AND g.sender_side = 'customer' AND g.created_at > COALESCE(m.company_last_read_at, '')`,
        companyId,
      )?.n ?? 0
    );
  }
  return 0;
}
