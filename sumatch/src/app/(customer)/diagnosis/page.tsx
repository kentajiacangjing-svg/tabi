import { getCurrentUser } from "@/lib/auth";
import { activeAreas, activeCategories } from "@/lib/queries";
import { parseJson } from "@/lib/db";
import { DiagnosisWizard } from "@/components/diagnosis-wizard";
import { Track } from "@/components/track";

export const metadata = { title: "無料で相談する" };
export const dynamic = "force-dynamic";

export default async function DiagnosisPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const user = await getCurrentUser();
  const categories = activeCategories().map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    icon: c.icon,
    price_min: c.price_min,
    price_max: c.price_max,
    price_note: c.price_note,
    concerns: parseJson<string[]>(c.concerns, []),
  }));
  const areas = activeAreas().map((a) => ({ prefecture: a.prefecture, city: a.city, postal_prefixes: a.postal_prefixes }));
  return (
    <>
      <Track kind="diagnosis_start" />
      <DiagnosisWizard categories={categories} areas={areas} loggedIn={!!user} wrongRole={!!user && user.role !== "customer"} initialCategory={category} />
    </>
  );
}
