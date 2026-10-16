import { requireBusiness } from "@/lib/auth";
import { conversationsForCompany } from "@/lib/queries";
import { ConversationList } from "@/components/chat-page";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "チャット" };
export const dynamic = "force-dynamic";

export default async function BusinessMessages() {
  const { membership } = await requireBusiness();
  const conversations = conversationsForCompany(membership.company.id);
  return (
    <div className="max-w-3xl">
      <PageHeader title="チャット" description="マッチしたお客様とのやり取りです。担当者全員が同じ画面で確認できます。" />
      {conversations.length ? (
        <ConversationList conversations={conversations} side="company" />
      ) : (
        <EmptyState icon="chat" title="まだチャットはありません" action={<ButtonLink href="/business/leads">案件を見る</ButtonLink>}>
          お客様と双方が希望するとチャットが始まります。
        </EmptyState>
      )}
    </div>
  );
}
