import { requireUser } from "@/lib/auth";
import { conversationsForCustomer } from "@/lib/queries";
import { ConversationList } from "@/components/chat-page";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "メッセージ" };
export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await requireUser(["customer"], "/messages");
  const conversations = conversationsForCustomer(user.id);
  return (
    <div className="mx-auto max-w-[720px]">
      <PageHeader title="メッセージ" />
      {conversations.length ? (
        <ConversationList conversations={conversations} side="customer" />
      ) : (
        <EmptyState title="まだメッセージはありません" action={<ButtonLink href="/matches">会社を見る</ButtonLink>}>
          「相談したい」を押した会社が対応したいと答えると、ここで話せるようになります。
        </EmptyState>
      )}
    </div>
  );
}
