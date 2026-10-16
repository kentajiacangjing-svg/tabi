import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { matchForUser } from "@/lib/access";
import { conversationsForCustomer } from "@/lib/queries";
import { ChatPage } from "@/components/chat-page";

export const metadata = { title: "チャット" };
export const dynamic = "force-dynamic";

export default async function CustomerChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["customer"], `/messages/${id}`);
  const ctx = matchForUser(id, user);
  if (!ctx || ctx.side !== "customer" || ctx.match.status !== "matched") notFound();
  return <ChatPage ctx={ctx} viewerName={user.name} conversations={conversationsForCustomer(user.id)} />;
}
