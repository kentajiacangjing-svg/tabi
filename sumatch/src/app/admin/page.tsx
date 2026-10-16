import Link from "next/link";
import { all, parseJson } from "@/lib/db";
import { kpis } from "@/lib/kpi";
import { allAreas, allCategories, getSetting } from "@/lib/queries";
import { PROJECT_STATUS } from "@/lib/constants";
import { dateShort, man, pct, relative, yen } from "@/lib/format";
import { CONTACT_FLAG_LABEL, type ContactFlag } from "@/lib/contact-detect";
import {
  resolveReportAction,
  setCompanyBillingAction,
  setCompanyStatusAction,
  setUserStatusAction,
  updateSettingAction,
  upsertAreaAction,
  upsertCategoryAction,
  upsertPlanAction,
} from "@/app/actions/admin";
import { ActionButton, ActionForm } from "@/components/action-button";
import { Badge, SectionTitle, Stat, cx, inputClass } from "@/components/ui";
import type { Company, Plan, ProjectStatus } from "@/lib/types";

export const metadata = { title: "管理画面" };
export const dynamic = "force-dynamic";

const TABS = [
  ["overview", "概要"],
  ["users", "ユーザー"],
  ["companies", "企業"],
  ["projects", "相談"],
  ["matches", "マッチ"],
  ["quotes", "見積もり"],
  ["contracts", "契約"],
  ["analytics", "分析"],
] as const;
const MORE = [
  ["chats", "チャット確認"],
  ["reports", "通報"],
  ["categories", "カテゴリ"],
  ["areas", "地域"],
  ["plans", "料金プラン"],
  ["outbox", "送信メール"],
] as const;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw = "overview" } = await searchParams;
  const tab = raw === "kpi" ? "overview" : raw;
  return (
    <div>
      <nav className="no-scrollbar -mx-5 mb-10 flex gap-1 overflow-x-auto border-b border-line px-5 sm:mx-0 sm:px-0" aria-label="管理メニュー">
        {[...TABS, ...MORE].map(([k, label], i) => (
          <Link
            key={k}
            href={`/admin?tab=${k}`}
            aria-current={tab === k ? "page" : undefined}
            className={cx(
              "relative flex min-h-12 shrink-0 items-center px-3 text-[15px]",
              i === TABS.length && "ml-4 border-l border-line pl-5",
              tab === k ? "text-ink after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-ink" : "text-muted hover:text-ink",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "overview" && <OverviewTab />}
      {tab === "analytics" && <AnalyticsTab />}
      {tab === "companies" && <CompaniesTab />}
      {tab === "users" && <UsersTab />}
      {tab === "projects" && <ProjectsTab />}
      {tab === "matches" && <MatchesTab />}
      {tab === "chats" && <ChatsTab />}
      {tab === "quotes" && <QuotesTab />}
      {tab === "contracts" && <ContractsTab />}
      {tab === "reports" && <ReportsTab />}
      {tab === "categories" && <CategoriesTab />}
      {tab === "areas" && <AreasTab />}
      {tab === "plans" && <PlansTab />}
      {tab === "outbox" && <OutboxTab />}
    </div>
  );
}

/* ---------------------------------------------------------------- */

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto border-y border-line">
      <table className="w-full min-w-[720px] text-[14px]">
        <thead>
          <tr className="text-left text-[13px] text-muted">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-3 font-normal first:pl-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-t [&>tr]:border-line [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_td:first-child]:pl-0">{children}</tbody>
      </table>
    </div>
  );
}

function OverviewTab() {
  const k = kpis(30);
  const nums: [string, number, string, string][] = [
    ["ユーザー", k.customers, "目標30人", "users"],
    ["企業", k.companies, `審査待ち ${k.pendingCompanies}社・目標10社`, "companies"],
    ["相談", k.projectsTotal, "", "projects"],
    ["マッチ", k.matchesTotal, "", "matches"],
    ["見積もり", k.quotesTotal, "", "quotes"],
    ["契約", k.contractsTotal, k.avgContract ? `平均 ${man(k.avgContract)}` : "", "contracts"],
  ];
  const alerts = [
    [k.pendingCompanies, "社の企業が審査を待っています", "companies"],
    [k.openReports, "件の通報が未対応です", "reports"],
    [k.flaggedMessages, "件の連絡先共有が検知されました（30日）", "chats"],
  ] as const;
  return (
    <div>
      <h1 className="text-[28px] font-semibold">概要</h1>
      <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-6">
        {nums.map(([label, v, sub, href]) => (
          <Link key={label} href={`/admin?tab=${href}`} className="hover:opacity-80">
            <Stat label={label} value={v} sub={sub} />
          </Link>
        ))}
      </div>
      {alerts.some(([n]) => n > 0) && (
        <ul className="mt-14 divide-y divide-line border-y border-line">
          {alerts
            .filter(([n]) => n > 0)
            .map(([n, text, href]) => (
              <li key={href}>
                <Link href={`/admin?tab=${href}`} className="flex min-h-14 items-center justify-between py-3 text-[16px] hover:text-brand">
                  <span>
                    {n}
                    {text}
                  </span>
                  <span className="text-muted">確認する</span>
                </Link>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function AnalyticsTab() {
  const k = kpis(30);
  const funnel = [
    ["訪問", k.visits],
    ["相談開始", k.starts],
    ["相談完了", k.completes],
    ["会社閲覧", k.companyViews],
    ["マッチ", k.matches],
    ["見積もり", k.quotes],
    ["契約", k.contracts],
  ] as const;
  const max = Math.max(1, funnel[0][1]);
  const dmax = Math.max(1, ...k.daily.map((d) => d.n));
  return (
    <div className="space-y-16">
      <section>
        <h1 className="text-[28px] font-semibold">ファネル（過去30日）</h1>
        <p className="mt-2 text-[14px] text-muted">右側のCVRは、ひとつ前の段階からの割合です。</p>
        <ol className="mt-8 space-y-3">
          {funnel.map(([label, v], i) => (
            <li key={label} className="grid grid-cols-[5.5rem_1fr_7.5rem] items-center gap-4 text-[15px]">
              <span>{label}</span>
              <span className="h-6 bg-line-2" title={`${label}: ${v}`}>
                <span className="block h-full rounded-r-[4px] bg-brand" style={{ width: `${Math.max(0.8, (v / max) * 100)}%` }} />
              </span>
              <span className="text-right tabular-nums">
                {v.toLocaleString()}
                <span className="ml-2 inline-block w-12 text-[13px] text-muted">{i > 0 ? (funnel[i - 1][1] ? pct(v / funnel[i - 1][1]) : "—") : ""}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-[15px] text-ink-2">
          訪問から契約まで {k.visits ? `${((k.contracts / k.visits) * 100).toFixed(2)}%` : "—"}・平均成約額 {k.avgContract ? man(k.avgContract) : "—"}・企業継続率 {k.retention == null ? "—" : pct(k.retention)}
        </p>
      </section>
      <section>
        <h2 className="text-[20px] font-medium">日別の訪問</h2>
        <div className="mt-6 flex h-44 items-end gap-[2px] border-b border-line" role="img" aria-label={`日別の訪問数。最大${dmax}件`}>
          {k.daily.map((d) => (
            <div key={d.d} className="group relative flex-1" style={{ height: `${(d.n / dmax) * 100}%` }}>
              <div className="size-full rounded-t-[4px] bg-brand/80 group-hover:bg-brand" />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[12px] text-white group-hover:block">
                {d.d.slice(5).replace("-", "/")}　{d.n}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[13px] text-muted">
          <span>{k.daily[0]?.d.slice(5).replace("-", "/")}</span>
          <span>{k.daily.at(-1)?.d.slice(5).replace("-", "/")}</span>
        </div>
      </section>
    </div>
  );
}

function CompaniesTab() {
  const plans = all<Plan>("SELECT * FROM plans ORDER BY sort");
  const rows = all<Company & { members: number; matches_month: number; plan_name: string | null }>(
    `SELECT c.*, (SELECT COUNT(*) FROM company_members m WHERE m.company_id = c.id) AS members,
            (SELECT COUNT(*) FROM matches m WHERE m.company_id = c.id AND m.matched_at >= ?) AS matches_month,
            p.name AS plan_name
       FROM companies c LEFT JOIN plans p ON p.id = c.plan_id ORDER BY (c.status = 'pending') DESC, c.created_at DESC`,
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
  );
  const tone = { pending: "warn", approved: "ok", rejected: "neutral", suspended: "danger" } as const;
  const label = { pending: "審査待ち", approved: "承認済み", rejected: "却下", suspended: "停止中" } as const;
  return (
    <Table head={["企業", "状態", "連絡先（運営のみ）", "許可・法人番号", "プラン / 無料期間", "今月マッチ", "操作"]}>
      {rows.map((c) => (
        <tr key={c.id}>
          <td>
            <Link href={`/company/${c.id}`} className="font-semibold hover:underline">{c.name}</Link>
            <div className="text-[11px] text-muted">{c.address}・担当者{c.members}名・登録 {dateShort(c.created_at)}</div>
            {c.web_interest ? <Badge tone="brand" className="mt-1">Web相談希望</Badge> : null}
          </td>
          <td><Badge tone={tone[c.status]}>{label[c.status]}</Badge></td>
          <td className="text-[12px]">{c.contact_person}<br />{c.phone}<br />{c.email}</td>
          <td className="text-[12px]">{c.license_number || "—"}<br />{c.corporate_number || ""}</td>
          <td>
            <ActionForm action={setCompanyBillingAction} className="flex flex-col gap-1">
              <input type="hidden" name="company_id" value={c.id} />
              <select name="plan_id" defaultValue={c.plan_id ?? ""} className="rounded-lg border border-line px-2 py-1 text-[12px]">
                <option value="">なし</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="date" name="trial_ends_at" defaultValue={c.trial_ends_at ?? ""} className="rounded-lg border border-line px-2 py-1 text-[12px]" />
              <button className="self-start text-[12px] font-semibold text-brand">保存</button>
            </ActionForm>
          </td>
          <td className="tabular-nums">{c.matches_month}</td>
          <td>
            <div className="flex flex-wrap gap-1.5">
              {c.status !== "approved" && <ActionButton tone="brand" action={setCompanyStatusAction.bind(null, c.id, "approved")}>承認</ActionButton>}
              {c.status === "pending" && <ActionButton action={setCompanyStatusAction.bind(null, c.id, "rejected")} confirmText="却下しますか？">却下</ActionButton>}
              {c.status === "approved" && <ActionButton tone="danger" action={setCompanyStatusAction.bind(null, c.id, "suspended")} confirmText={`${c.name}を停止しますか？担当者もログインできなくなります。`}>停止</ActionButton>}
            </div>
          </td>
        </tr>
      ))}
    </Table>
  );
}

function UsersTab() {
  const rows = all<{ id: string; name: string; email: string; role: string; status: string; created_at: string; last_login_at: string | null; projects: number; company: string | null }>(
    `SELECT u.*, (SELECT COUNT(*) FROM projects p WHERE p.customer_id = u.id) AS projects,
            (SELECT c.name FROM company_members m JOIN companies c ON c.id = m.company_id WHERE m.user_id = u.id) AS company
       FROM users u ORDER BY u.created_at DESC LIMIT 500`,
  );
  const role = { customer: "一般", business: "企業", admin: "運営" } as Record<string, string>;
  return (
    <Table head={["名前", "メール", "種別", "相談数", "登録", "最終ログイン", "状態"]}>
      {rows.map((u) => (
        <tr key={u.id}>
          <td className="font-semibold">{u.name}{u.company && <div className="text-[11px] font-normal text-muted">{u.company}</div>}</td>
          <td>{u.email}</td>
          <td>{role[u.role]}</td>
          <td className="tabular-nums">{u.projects || "—"}</td>
          <td>{dateShort(u.created_at)}</td>
          <td>{relative(u.last_login_at) || "—"}</td>
          <td>
            {u.role === "admin" ? (
              <Badge>運営</Badge>
            ) : u.status === "active" ? (
              <ActionButton tone="danger" action={setUserStatusAction.bind(null, u.id, "suspended")} confirmText={`${u.name}を停止しますか？`}>停止</ActionButton>
            ) : (
              <ActionButton action={setUserStatusAction.bind(null, u.id, "active")}>再開</ActionButton>
            )}
          </td>
        </tr>
      ))}
    </Table>
  );
}

function ProjectsTab() {
  const rows = all<{ id: string; title: string; city: string; status: ProjectStatus; created_at: string; customer: string; category: string; candidates: number; matched: number; quotes: number; budget_min: number | null; budget_max: number | null }>(
    `SELECT p.*, u.name AS customer, c.name AS category,
            (SELECT COUNT(*) FROM matches m WHERE m.project_id = p.id) AS candidates,
            (SELECT COUNT(*) FROM matches m WHERE m.project_id = p.id AND m.status = 'matched') AS matched,
            (SELECT COUNT(*) FROM quotes q WHERE q.project_id = p.id AND q.status != 'superseded') AS quotes
       FROM projects p JOIN users u ON u.id = p.customer_id JOIN categories c ON c.id = p.category_id ORDER BY p.created_at DESC LIMIT 500`,
  );
  return (
    <Table head={["案件", "お客様", "カテゴリ", "地域", "状態", "候補 / マッチ / 見積", "作成"]}>
      {rows.map((p) => (
        <tr key={p.id}>
          <td className="font-semibold">{p.title}</td>
          <td>{p.customer}</td>
          <td>{p.category}</td>
          <td>{p.city}</td>
          <td><Badge tone="brand">{PROJECT_STATUS[p.status].label}</Badge></td>
          <td className="tabular-nums">{p.candidates} / {p.matched} / {p.quotes}</td>
          <td>{dateShort(p.created_at)}</td>
        </tr>
      ))}
    </Table>
  );
}

function MatchesTab() {
  const rows = all<{ id: string; score: number; reasons: string; customer_interest: number; company_response: string; status: string; matched_at: string | null; created_at: string; company: string; customer: string; title: string; city: string }>(
    `SELECT m.*, c.name AS company, u.name AS customer, p.title, p.city FROM matches m
       JOIN companies c ON c.id = m.company_id JOIN projects p ON p.id = m.project_id JOIN users u ON u.id = p.customer_id
      ORDER BY m.created_at DESC LIMIT 500`,
  );
  const resp = { none: "未回答", yes: "対応したい", no: "見送り" } as Record<string, string>;
  return (
    <Table head={["案件", "企業", "マッチ度", "お客様の希望", "企業の回答", "状態", "成立日"]}>
      {rows.map((m) => (
        <tr key={m.id}>
          <td>{m.customer}・{m.city}<div className="text-[11px] text-muted">{m.title}</div></td>
          <td>{m.company}</td>
          <td className="tabular-nums">{m.score}%<div className="text-[11px] text-muted">{parseJson<string[]>(m.reasons, []).slice(1).join("・")}</div></td>
          <td>{m.customer_interest ? "話したい" : "—"}</td>
          <td>{resp[m.company_response]}</td>
          <td>{m.status === "matched" ? <Badge tone="ok">成立</Badge> : m.status === "closed" ? <Badge>終了</Badge> : <Badge tone="brand">候補</Badge>}</td>
          <td>{m.matched_at ? dateShort(m.matched_at) : "—"}</td>
        </tr>
      ))}
    </Table>
  );
}

function ChatsTab() {
  const flagged = all<{ id: string; body: string; contact_flags: string; created_at: string; match_id: string; sender_side: string; sender: string | null; company: string; customer: string }>(
    `SELECT g.*, u.name AS sender, c.name AS company, cu.name AS customer FROM messages g
       LEFT JOIN users u ON u.id = g.sender_user_id JOIN matches m ON m.id = g.match_id JOIN companies c ON c.id = m.company_id
       JOIN projects p ON p.id = m.project_id JOIN users cu ON cu.id = p.customer_id
      WHERE g.contact_flags != '' ORDER BY g.created_at DESC LIMIT 200`,
  );
  const convs = all<{ id: string; company: string; customer: string; city: string; n: number; last: string | null }>(
    `SELECT m.id, c.name AS company, u.name AS customer, p.city, (SELECT COUNT(*) FROM messages g WHERE g.match_id = m.id) AS n, m.last_message_at AS last
       FROM matches m JOIN companies c ON c.id = m.company_id JOIN projects p ON p.id = m.project_id JOIN users u ON u.id = p.customer_id
      WHERE m.status = 'matched' ORDER BY m.last_message_at DESC LIMIT 300`,
  );
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>連絡先共有が検知されたメッセージ</SectionTitle>
        {flagged.length === 0 ? (
          <p className="text-sm text-muted">検知はありません。</p>
        ) : (
          <Table head={["日時", "会話", "送信者", "検知", "内容"]}>
            {flagged.map((f) => (
              <tr key={f.id}>
                <td>{relative(f.created_at)}</td>
                <td><Link href={`/admin/chats/${f.match_id}`} className="text-brand hover:underline">{f.customer} × {f.company}</Link></td>
                <td>{f.sender_side === "customer" ? "お客様" : "企業"}・{f.sender}</td>
                <td><Badge tone="warn">{f.contact_flags.split(",").map((x) => CONTACT_FLAG_LABEL[x as ContactFlag]).join("・")}</Badge></td>
                <td className="max-w-xs whitespace-pre-wrap text-[12px]">{f.body}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>
      <div>
        <SectionTitle>すべての会話</SectionTitle>
        <Table head={["お客様", "企業", "地域", "メッセージ数", "最終"]}>
          {convs.map((c) => (
            <tr key={c.id}>
              <td><Link href={`/admin/chats/${c.id}`} className="font-semibold text-brand hover:underline">{c.customer}</Link></td>
              <td>{c.company}</td>
              <td>{c.city}</td>
              <td className="tabular-nums">{c.n}</td>
              <td>{relative(c.last)}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}

function QuotesTab() {
  const rows = all<{ id: string; title: string; total: number; status: string; version: number; created_at: string; company: string; customer: string; warranty_years: number; duration: string }>(
    `SELECT q.*, c.name AS company, u.name AS customer FROM quotes q JOIN companies c ON c.id = q.company_id
       JOIN projects p ON p.id = q.project_id JOIN users u ON u.id = p.customer_id ORDER BY q.created_at DESC LIMIT 500`,
  );
  const st = { submitted: "提出", superseded: "旧版", accepted: "採用", declined: "不採用" } as Record<string, string>;
  return (
    <Table head={["日付", "企業", "お客様", "件名", "金額（税込）", "保証 / 工期", "状態"]}>
      {rows.map((q) => (
        <tr key={q.id}>
          <td>{dateShort(q.created_at)}</td>
          <td>{q.company}</td>
          <td>{q.customer}</td>
          <td>{q.title}{q.version > 1 && <span className="text-muted">（第{q.version}版）</span>}</td>
          <td className="tabular-nums font-semibold">{yen(q.total)}</td>
          <td>{q.warranty_years}年 / {q.duration}</td>
          <td>{st[q.status]}</td>
        </tr>
      ))}
    </Table>
  );
}

function ContractsTab() {
  const rows = all<{ id: string; amount: number; status: string; contract_date: string | null; start_date: string | null; success_fee_rate: number; company: string; customer: string; title: string }>(
    `SELECT ct.*, c.name AS company, u.name AS customer, p.title FROM contracts ct JOIN companies c ON c.id = ct.company_id
       JOIN projects p ON p.id = ct.project_id JOIN users u ON u.id = p.customer_id ORDER BY ct.created_at DESC`,
  );
  const st = { contracted: "契約", in_progress: "工事中", completed: "完了", cancelled: "キャンセル" } as Record<string, string>;
  return (
    <Table head={["お客様 / 案件", "企業", "契約金額", "成功報酬", "契約日", "工事予定日", "状態"]}>
      {rows.map((c) => (
        <tr key={c.id}>
          <td>{c.customer}<div className="text-[11px] text-muted">{c.title}</div></td>
          <td>{c.company}</td>
          <td className="tabular-nums font-semibold">{yen(c.amount)}</td>
          <td className="tabular-nums">{yen(c.amount * c.success_fee_rate)}<span className="text-[11px] text-muted">（{Math.round(c.success_fee_rate * 1000) / 10}%）</span></td>
          <td>{c.contract_date ?? "—"}</td>
          <td>{c.start_date ?? "—"}</td>
          <td><Badge tone={c.status === "completed" ? "ok" : "brand"}>{st[c.status]}</Badge></td>
        </tr>
      ))}
    </Table>
  );
}

function ReportsTab() {
  const rows = all<{ id: string; target_type: string; target_id: string; reason: string; detail: string; status: string; created_at: string; reporter: string | null; role: string | null }>(
    "SELECT r.*, u.name AS reporter, u.role FROM reports r LEFT JOIN users u ON u.id = r.reporter_user_id ORDER BY (r.status = 'open') DESC, r.created_at DESC",
  );
  if (!rows.length) return <p className="text-sm text-muted">通報はありません。</p>;
  return (
    <Table head={["日時", "通報者", "対象", "理由", "詳細", "状態"]}>
      {rows.map((r) => (
        <tr key={r.id}>
          <td>{relative(r.created_at)}</td>
          <td>{r.reporter}（{r.role === "business" ? "企業" : "一般"}）</td>
          <td>{r.target_type === "match" ? <Link href={`/admin/chats/${r.target_id}`} className="text-brand hover:underline">会話を見る</Link> : r.target_id}</td>
          <td>{r.reason}</td>
          <td className="max-w-xs text-[12px]">{r.detail || "—"}</td>
          <td>{r.status === "open" ? <ActionButton tone="brand" action={resolveReportAction.bind(null, r.id)}>対応済みにする</ActionButton> : <Badge>対応済み</Badge>}</td>
        </tr>
      ))}
    </Table>
  );
}

const small = cx(inputClass, "px-2.5 py-1.5 text-[13px]");

function CategoriesTab() {
  const rows = allCategories();
  const form = (c?: (typeof rows)[number]) => (
    <ActionForm key={c?.id ?? "new"} action={upsertCategoryAction} className="grid items-end gap-2 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,2fr)_auto]">
      <input type="hidden" name="id" value={c?.id ?? ""} />
      <label className="text-[11px] text-muted">名前<input name="name" defaultValue={c?.name} className={small} required /></label>
      <label className="text-[11px] text-muted">スラッグ<input name="slug" defaultValue={c?.slug} className={small} required /></label>
      <label className="text-[11px] text-muted">相場下限（円）<input name="price_min" type="number" defaultValue={c?.price_min ?? 0} className={small} /></label>
      <label className="text-[11px] text-muted">相場上限（円）<input name="price_max" type="number" defaultValue={c?.price_max ?? 0} className={small} /></label>
      <label className="text-[11px] text-muted">お悩みの選択肢（読点区切り）<input name="concerns" defaultValue={parseJson<string[]>(c?.concerns, []).join("、")} className={small} /></label>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1 text-[12px]"><input type="checkbox" name="active" defaultChecked={c ? !!c.active : true} />公開</label>
        <button className="min-h-10 rounded-lg bg-brand px-4 text-[13px] font-medium text-white">{c ? "保存" : "追加"}</button>
      </div>
      <input type="hidden" name="group_name" value={c?.group_name ?? "住まい"} />
      <input type="hidden" name="icon" value={c?.icon ?? "home"} />
      <input type="hidden" name="sort" value={c?.sort ?? rows.length} />
      <label className="text-[11px] text-muted sm:col-span-2">説明<input name="description" defaultValue={c?.description} className={small} /></label>
      <label className="text-[11px] text-muted sm:col-span-3">相場の注記<input name="price_note" defaultValue={c?.price_note} className={small} /></label>
    </ActionForm>
  );
  return (
    <div className="space-y-2">
      <p className="mb-3 text-[13px] text-muted">非公開のカテゴリはトップに「まもなく」として表示されます。カテゴリを公開すると、診断と企業登録で選べるようになります。</p>
      {rows.map((c) => form(c))}
      <SectionTitle>カテゴリを追加</SectionTitle>
      {form()}
    </div>
  );
}

function AreasTab() {
  const rows = allAreas();
  const form = (a?: (typeof rows)[number]) => (
    <ActionForm key={a?.id ?? "new"} action={upsertAreaAction} className="grid items-end gap-2 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_1fr_1fr_1.4fr_auto]">
      <input type="hidden" name="id" value={a?.id ?? ""} />
      <input type="hidden" name="sort" value={a?.sort ?? rows.length} />
      <label className="text-[11px] text-muted">都道府県<input name="prefecture" defaultValue={a?.prefecture ?? "神奈川県"} className={small} required /></label>
      <label className="text-[11px] text-muted">市区町村<input name="city" defaultValue={a?.city} className={small} required /></label>
      <label className="text-[11px] text-muted">地域名<input name="region" defaultValue={a?.region} className={small} /></label>
      <label className="text-[11px] text-muted">郵便番号の先頭3桁<input name="postal_prefixes" defaultValue={a?.postal_prefixes} placeholder="251,252" className={small} /></label>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1 text-[12px]"><input type="checkbox" name="active" defaultChecked={a ? !!a.active : true} />対応中</label>
        <button className="min-h-10 rounded-lg bg-brand px-4 text-[13px] font-medium text-white">{a ? "保存" : "追加"}</button>
      </div>
    </ActionForm>
  );
  return (
    <div className="space-y-2">
      {rows.map((a) => form(a))}
      <SectionTitle>エリアを追加</SectionTitle>
      {form()}
    </div>
  );
}

function PlansTab() {
  const rows = all<Plan>("SELECT * FROM plans ORDER BY sort");
  const form = (p?: Plan) => (
    <ActionForm key={p?.id ?? "new"} action={upsertPlanAction} className="grid items-end gap-2 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_1.6fr_auto]">
      <input type="hidden" name="id" value={p?.id ?? ""} />
      <input type="hidden" name="sort" value={p?.sort ?? rows.length} />
      <label className="text-[11px] text-muted">コード<input name="code" defaultValue={p?.code} className={small} required /></label>
      <label className="text-[11px] text-muted">表示名<input name="name" defaultValue={p?.name} className={small} required /></label>
      <label className="text-[11px] text-muted">月額（円）<input name="monthly_price" type="number" defaultValue={p?.monthly_price} className={small} required /></label>
      <label className="text-[11px] text-muted">月間マッチ上限<input name="match_limit" type="number" defaultValue={p?.match_limit} className={small} required /></label>
      <label className="text-[11px] text-muted">成功報酬（%）<input name="success_fee_percent" type="number" step="0.1" defaultValue={p ? Math.round(p.success_fee_rate * 1000) / 10 : 3} className={small} required /></label>
      <label className="text-[11px] text-muted">説明<input name="description" defaultValue={p?.description} className={small} /></label>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1 text-[12px]"><input type="checkbox" name="active" defaultChecked={p ? !!p.active : true} />公開</label>
        <button className="min-h-10 rounded-lg bg-brand px-4 text-[13px] font-medium text-white">{p ? "保存" : "追加"}</button>
      </div>
    </ActionForm>
  );
  return (
    <div className="space-y-2">
      <p className="mb-3 text-[13px] text-muted">変更はすぐに企業向けページ（/business）と企業の設定画面に反映されます。プランはマッチングの順位に影響しません。</p>
      {rows.map((p) => form(p))}
      <SectionTitle>プランを追加</SectionTitle>
      {form()}
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <ActionForm action={updateSettingAction} className="flex items-end gap-2 rounded-xl border border-line bg-surface p-4">
          <input type="hidden" name="key" value="default_trial_days" />
          <label className="flex-1 text-[11px] text-muted">新規企業の無料期間（日）<input name="value" type="number" defaultValue={getSetting("default_trial_days", "60")} className={small} /></label>
          <button className="min-h-10 rounded-lg bg-brand px-4 text-[13px] font-medium text-white">保存</button>
        </ActionForm>
        <ActionForm action={updateSettingAction} className="flex items-end gap-2 rounded-xl border border-line bg-surface p-4">
          <input type="hidden" name="key" value="success_fee_note" />
          <label className="flex-1 text-[11px] text-muted">成功報酬の注記<input name="value" defaultValue={getSetting("success_fee_note")} className={small} /></label>
          <button className="min-h-10 rounded-lg bg-brand px-4 text-[13px] font-medium text-white">保存</button>
        </ActionForm>
      </div>
    </div>
  );
}

function OutboxTab() {
  const rows = all<{ id: string; to_email: string; subject: string; body: string; created_at: string }>("SELECT * FROM email_outbox ORDER BY created_at DESC LIMIT 200");
  return (
    <div>
      <p className="mb-3 text-[13px] text-muted">MVPではメールは送信キューに記録されます。SMTP・LINE公式アカウント等の送信処理を接続するとここから配信されます。</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">まだ通知メールはありません。</p>
      ) : (
        <Table head={["日時", "宛先", "件名", "本文"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{relative(r.created_at)}</td>
              <td>{r.to_email}</td>
              <td className="font-semibold">{r.subject}</td>
              <td className="max-w-md whitespace-pre-wrap text-[12px] text-muted">{r.body}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
