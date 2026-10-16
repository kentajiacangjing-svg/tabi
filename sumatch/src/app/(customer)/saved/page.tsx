import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { workImage } from "@/lib/queries";
import { cityOf } from "@/lib/format";
import { SavedActions } from "@/components/saved-actions";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "保存した会社" };
export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const user = await requireUser(["customer"], "/saved");
  const rows = all<{ match_id: string; project_id: string; project_title: string; company_id: string; name: string; address: string; tagline: string; rating_avg: number; works_total: number; category_id: string; status: string; project_status: string; requested: number }>(
    `SELECT m.id AS match_id, p.id AS project_id, p.title AS project_title, c.id AS company_id, c.name, c.address, c.tagline, c.rating_avg, c.works_total,
            p.category_id,
            m.status, p.status AS project_status,
            (SELECT COUNT(*) FROM matches x WHERE x.project_id = p.id AND x.customer_interest = 1 AND x.company_response != 'no') AS requested
       FROM matches m JOIN projects p ON p.id = m.project_id JOIN companies c ON c.id = m.company_id
      WHERE p.customer_id = ? AND m.customer_saved = 1 AND m.customer_interest = 0 ORDER BY p.updated_at DESC`,
    user.id,
  );
  return (
    <div className="mx-auto max-w-[720px]">
      <PageHeader title="保存した会社" description="あとで考えたい会社をここに残しておけます。" />
      {rows.length === 0 ? (
        <EmptyState title="まだ保存した会社はありません" action={<ButtonLink href="/matches">会社を見る</ButtonLink>}>
          会社を見ているときに「保存」を押すと、ここに残ります。
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {rows.map((r) => {
            const img = workImage(
              get<{ image_url: string | null; file_id: string | null }>(
                "SELECT image_url, file_id FROM company_works WHERE company_id = ? ORDER BY (category_id = ?) DESC, created_at DESC LIMIT 1",
                r.company_id,
                r.category_id,
              ),
            );
            const open = ["consulting", "quoting", "comparing"].includes(r.project_status);
            return (
              <li key={r.match_id} className="flex gap-4 py-5">
                <Link href={`/company/${r.company_id}?project=${r.project_id}`} className="size-24 shrink-0 overflow-hidden rounded-lg bg-soft">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {img && <img src={img} alt="" className="size-full object-cover" />}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/company/${r.company_id}?project=${r.project_id}`} className="text-[18px] font-medium hover:underline">
                    {r.name}
                  </Link>
                  <div className="text-[14px] text-muted">
                    {cityOf(r.address)}・★{r.rating_avg.toFixed(1)}・施工実績{r.works_total.toLocaleString()}件
                  </div>
                  <div className="mt-0.5 text-[13px] text-faint">{r.project_title}</div>
                  <SavedActions matchId={r.match_id} canConsult={open && r.requested < 3} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
