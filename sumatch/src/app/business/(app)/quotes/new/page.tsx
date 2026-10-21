import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { matchForUser } from "@/lib/access";
import { all, get } from "@/lib/db";
import { QuoteForm, type QuoteDefaults } from "@/components/quote-form";
import { PageHeader, Notice } from "@/components/ui";
import { contractForMatch, effectiveStage, latestQuoteForMatch } from "@/lib/contract";
import type { Category, QuoteItem } from "@/lib/types";

export const metadata = { title: "見積作成" };
export const dynamic = "force-dynamic";

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ match?: string }> }) {
  const { match } = await searchParams;
  const { user, membership } = await requireBusiness();
  const ctx = match ? matchForUser(match, user) : null;
  if (!ctx || ctx.side !== "company" || ctx.match.status !== "matched") notFound();
  const cat = get<Category>("SELECT name FROM categories WHERE id = ?", ctx.project.category_id);
  const customer = get<{ name: string }>("SELECT name FROM users WHERE id = ?", ctx.project.customer_id);
  const prev = latestQuoteForMatch(ctx.match.id);
  // Same rule as submitQuote: open until a company is chosen; the chosen company may revise until both agree.
  const chosen = contractForMatch(ctx.match.id);
  const closed = chosen ? effectiveStage(chosen) === "agreed" : !["consulting", "quoting", "comparing"].includes(ctx.project.status);
  const c = membership.company;
  const defaults: QuoteDefaults = prev
    ? {
        ...prev,
        items: all<QuoteItem>("SELECT * FROM quote_items WHERE quote_id = ? ORDER BY sort", prev.id).map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, unit_price: i.unit_price })),
      }
    : {
        title: `${cat?.name ?? ""}工事`,
        items: [],
        overhead: 0,
        discount: 0,
        warranty: c.warranty,
        warranty_years: Number(c.warranty.match(/(\d+)年/)?.[1] ?? 0),
        duration: "",
        duration_days: null,
        materials: "",
        payment_terms: "",
        extra_costs: "",
        notes: "",
      };
  return (
    <div className="max-w-4xl">
      <PageHeader
        back={{ href: `/business/messages/${ctx.match.id}`, label: "チャットへ戻る" }}
        eyebrow={`${customer?.name}様・${ctx.project.city}`}
        title={prev ? `見積の改訂（第${prev.version + 1}版）` : "見積作成"}
        description="提出するとチャットに見積書カードが送られ、お客様の比較画面に反映されます。"
      />
      {closed ? (
        <Notice tone="warn">{chosen ? "双方の合意が確認済みのため、見積は変更できません。" : "この案件は依頼先が決定済みのため、見積を提出できません。"}</Notice>
      ) : (
        <>
          {chosen && <Notice tone="warn" className="mb-6">改訂すると、契約条件の金額が新しい見積に置き換わり、お客様と御社の同意はいったん取り消されます。</Notice>}
          <QuoteForm matchId={ctx.match.id} defaults={defaults} revision={!!prev} />
        </>
      )}
    </div>
  );
}
