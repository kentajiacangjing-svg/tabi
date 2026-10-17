// チャットの「AI返信下書き」。ANTHROPIC_API_KEY があれば Claude で下書き、なければテンプレートで下書きする。
// 下書きは入力欄に入るだけで、送信は必ず本人が行う。
import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage } from "./queries";

export interface DraftContext {
  side: "customer" | "company";
  companyName: string;
  customerName: string;
  categoryName: string;
  city: string;
  projectSummary: string;
  messages: ChatMessage[];
}

const SYSTEM = `あなたは住まいのサービスマッチングプラットフォーム「SUMATCH」のチャットで、返信の下書きを作るアシスタントです。
- 日本語で、丁寧かつ簡潔に（3〜5文程度）書いてください。
- 電話番号・メールアドレス・LINE ID・SNSなど、SUMATCH外の連絡先を書いたり求めたりしないでください。日程調整や資料共有はSUMATCH内で行う前提です。
- 金額や工期を新しく断定しないでください。不明点は確認する形にしてください。
- 下書き本文だけを出力してください（前置きや説明は不要）。`;

function templateDraft(ctx: DraftContext) {
  const last = [...ctx.messages].reverse().find((m) => m.sender_side !== ctx.side && m.sender_side !== "system");
  if (ctx.side === "company") {
    if (!last) return `${ctx.customerName}様\n\nはじめまして、${ctx.companyName}です。${ctx.categoryName}のご相談ありがとうございます。お写真とご要望を拝見しました。現地調査のご希望日時を2〜3候補いただけますでしょうか。`;
    if (/見積|金額|費用/.test(last.body)) return `${ctx.customerName}様\n\nご質問ありがとうございます。お見積の内容について、項目ごとにご説明いたします。追加費用が発生する可能性がある箇所は事前にお知らせしますので、ご不明点があればこちらでお気軽にお尋ねください。`;
    if (/日|曜|時/.test(last.body)) return `${ctx.customerName}様\n\nご連絡ありがとうございます。ご提示いただいた日時で調整いたします。確定しましたらこちらのチャットでお知らせします。`;
    return `${ctx.customerName}様\n\nご連絡ありがとうございます。内容を確認のうえ、改めてご回答いたします。引き続きよろしくお願いいたします。`;
  }
  if (!last) return `はじめまして。${ctx.categoryName}の件でご相談させてください。よろしくお願いします。`;
  if (/見積/.test(last.body)) return `お見積ありがとうございます。内容を確認しました。追加費用が発生する可能性がある項目があれば教えてください。`;
  if (/調査|伺|日程|候補/.test(last.body)) return `ありがとうございます。候補日ですが、今週末の午前中か、平日の夕方以降でお願いできますでしょうか。`;
  return `ありがとうございます。確認しました。引き続きよろしくお願いします。`;
}

export async function draftReply(ctx: DraftContext): Promise<{ text: string; source: "ai" | "template" }> {
  if (!process.env.ANTHROPIC_API_KEY) return { text: templateDraft(ctx), source: "template" };
  try {
    const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });
    const transcript = ctx.messages
      .slice(-20)
      .map((m) => {
        const who = m.sender_side === "system" ? "システム" : m.sender_side === "customer" ? `お客様（${ctx.customerName}）` : `会社（${ctx.companyName}）`;
        const body = m.kind === "quote" ? `［見積書 ${m.quote_total?.toLocaleString("ja-JP")}円］` : m.kind === "text" || m.kind === "system" ? m.body : "［ファイル］";
        return `${who}: ${body}`;
      })
      .join("\n");
    const writer = ctx.side === "company" ? `会社（${ctx.companyName}）の担当者` : `お客様（${ctx.customerName}）`;
    const response = await client.beta.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `案件: ${ctx.projectSummary}\n\nこれまでのやり取り:\n${transcript || "（まだメッセージはありません）"}\n\n${writer}として、次に送る返信の下書きを書いてください。`,
        },
      ],
    });
    if (response.stop_reason === "refusal") return { text: templateDraft(ctx), source: "template" };
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return text ? { text, source: "ai" } : { text: templateDraft(ctx), source: "template" };
  } catch (e) {
    console.error("[ai-draft]", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    return { text: templateDraft(ctx), source: "template" };
  }
}
