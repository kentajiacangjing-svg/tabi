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
    <div>
      <PageHeader title="メッセージ" description="マッチした会社とのやり取りです。連絡先を交換しなくても、ここで相談から契約まで進められます。" />
      {conversations.length ? (
        <ConversationList conversations={conversations} side="customer" />
      ) : (
        <EmptyState icon="chat" title="まだメッセージはありません" action={<ButtonLink href="/matches">会社を選ぶ</ButtonLink>}>
          「この会社と話したい」を選び、会社も対応を希望するとチャットが始まります。
        </EmptyState>
      )}
    </div>
  );
}
