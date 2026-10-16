import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { all } from "@/lib/db";
import { activeAreas, activeCategories } from "@/lib/queries";
import { CompanyForm, EMPTY_COMPANY } from "@/components/company-form";
import { PageHeader } from "@/components/ui";
import type { Plan } from "@/lib/types";

export const metadata = { title: "企業登録" };
export const dynamic = "force-dynamic";

export default async function BusinessSignupPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const plans = all<Plan>("SELECT * FROM plans WHERE active = 1 ORDER BY sort");
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="SUMATCH for Business"
        title="企業登録"
        description="登録後、運営が内容を確認します（通常1〜2営業日）。審査完了後から案件を受け取れます。"
      />
      <CompanyForm
        mode="signup"
        initial={EMPTY_COMPANY}
        categories={activeCategories().map((c) => ({ id: c.id, name: c.name }))}
        areas={activeAreas().map((a) => ({ id: a.id, name: a.city, sub: a.prefecture }))}
        plans={plans.map((p) => ({ code: p.code, label: `${p.name}（月${p.monthly_price.toLocaleString()}円・${p.match_limit}マッチ）` }))}
        defaultPlan={plan ?? plans[0]?.code}
      />
    </main>
  );
}
