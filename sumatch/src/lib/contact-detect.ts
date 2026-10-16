// Detects attempts to exchange personal contact details in chat.
// MVP behaviour: warn the sender before sending and flag the message for admins.

export type ContactFlag = "phone" | "email" | "line" | "qr" | "sns" | "url";

export const CONTACT_FLAG_LABEL: Record<ContactFlag, string> = {
  phone: "電話番号",
  email: "メールアドレス",
  line: "LINE ID",
  qr: "QRコード",
  sns: "SNSアカウント",
  url: "外部URL",
};

const PHONE = /(?<!\d)(?:\+?81[-\s]?|0)\d{1,4}[-\s()]?\d{1,4}[-\s)]?\d{3,4}(?!\d)/;
const PHONE_DIGITS = /(?<!\d)0\d{9,10}(?!\d)/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const LINE = /(\bline\b|(?<!オン|ガイド|デッド|ネック|アウト|ボーダー)ライン|らいん|lin\.ee|line\.me)/i;
const QR = /(qr|ｑｒ|キューアール)/i;
const SNS = /(instagram|インスタ|twitter|ツイッター|x\.com|facebook|フェイスブック|tiktok|@[A-Za-z0-9_.]{3,}(?![A-Za-z0-9.-]*\.[A-Za-z]{2,}))/i;
const URL = /https?:\/\/[^\s]+/i;

const KANJI_DIGITS: Record<string, string> = {
  "〇": "0", 零: "0", 一: "1", 二: "2", 三: "3", 四: "4", 五: "5", 六: "6", 七: "7", 八: "8", 九: "9",
};

/** Normalise full-width characters, Japanese dashes and kanji digits so tricks like "０９０ー１２３４…" are caught. */
export function normalizeForDetection(text: string) {
  let t = text.normalize("NFKC");
  t = t.replace(/[‐‑‒–—―ー−ｰ]/g, "-");
  // Only convert kanji digits when they appear in runs (avoid touching normal words).
  t = t.replace(/[〇零一二三四五六七八九]{3,}/g, (run) => run.split("").map((c) => KANJI_DIGITS[c] ?? c).join(""));
  return t;
}

export function detectContactInfo(text: string): ContactFlag[] {
  const t = normalizeForDetection(text);
  const flags = new Set<ContactFlag>();
  const digitsOnly = t.replace(/[\s\-()]/g, "");
  if (PHONE.test(t) || PHONE_DIGITS.test(digitsOnly)) flags.add("phone");
  if (EMAIL.test(t)) flags.add("email");
  if (LINE.test(t)) flags.add("line");
  if (QR.test(t)) flags.add("qr");
  if (!flags.has("email") && SNS.test(t)) flags.add("sns");
  if (URL.test(t)) flags.add("url");
  return [...flags];
}

export const CONTACT_WARNING =
  "SUMATCH外での連絡先交換は、保証・成約管理の対象外になる場合があります。やり取りはSUMATCH内で続けることをおすすめします。";
