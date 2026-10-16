import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { matchForUser } from "@/lib/access";
import { conversationsForCompany } from "@/lib/queries";
import { ChatPage } from "@/components/chat-page";

export const metadata = { title: "チャット" };
export const dynamic = "force-dynamic";

export default async function BusinessChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, membership } = await requireBusiness();
  const ctx = matchForUser(id, user);
  if (!ctx || ctx.side !== "company" || ctx.match.status !== "matched") notFound();
  return <ChatPage ctx={ctx} viewerName={user.name} conversations={conversationsForCompany(membership.company.id)} />;
}
