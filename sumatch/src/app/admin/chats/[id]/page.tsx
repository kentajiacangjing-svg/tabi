import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { logAdminAccess, matchForUser } from "@/lib/access";
import { ChatPage } from "@/components/chat-page";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function AdminChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(["admin"], "/admin");
  const ctx = matchForUser(id, user);
  if (!ctx) notFound();
  logAdminAccess(user, "chat", id);
  return (
    <div>
      <Link href="/admin?tab=chats" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <Icon name="chevron-left" size={16} />
        チャット確認
      </Link>
      <ChatPage ctx={ctx} viewerName={user.name} conversations={[]} />
    </div>
  );
}
