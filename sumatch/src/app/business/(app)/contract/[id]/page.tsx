import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { get } from "@/lib/db";
import { ContractPanel } from "@/components/contract-panel";
import { Icon } from "@/components/icons";
import type { Category, Contract, Project } from "@/lib/types";

export const metadata = { title: "契約条件" };
export const dynamic = "force-dynamic";

export default async function BusinessContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireBusiness();
  const c = get<Contract>("SELECT * FROM contracts WHERE id = ?", id);
  // Only the chosen company sees its contract — other companies get the same 404 as a missing id.
  if (!c || c.company_id !== membership.company.id) notFound();
  const project = get<Project>("SELECT * FROM projects WHERE id = ?", c.project_id)!;
  const category = get<Category>("SELECT name FROM categories WHERE id = ?", project.category_id);
  const customer = get<{ name: string }>("SELECT name FROM users WHERE id = ?", project.customer_id);
  return (
    <div className="mx-auto max-w-[760px]">
      <Link href="/business/active" className="-ml-1 mb-4 inline-flex min-h-11 items-center gap-1 text-[15px] text-muted hover:text-ink">
        <Icon name="chevron-left" size={18} />
        進行中の相談
      </Link>
      <p className="text-[14px] text-muted">
        {[project.city, category?.name].filter(Boolean).join("・")}
      </p>
      <h1 className="mt-1 text-[26px] font-semibold">{customer?.name ?? "お客"}様の契約条件</h1>
      <div className="mt-8">
        <ContractPanel contract={c} viewer="company" />
      </div>
    </div>
  );
}
