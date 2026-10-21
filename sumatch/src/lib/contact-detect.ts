// Detects attempts to exchange personal contact details in chat (and other text the other side reads).
//
// Two tiers:
//   • BLOCKED before both sides have agreed the contract terms: phone, email, LINE, SNS handles/DMs,
//     and links whose purpose is direct contact (line.me, instagram.com, wa.me, mailto:, tel: …).
//     The server refuses these; the message is not stored.
//   • WARN only: other web links (e.g. a manufacturer's catalogue page) and mentions of a QR code.
//     They are sent, flagged for the operator, and the sender sees a reminder.
//
// Detection is deliberately conservative so that prices, dates, sizes, model numbers and times pass.

export type ContactFlag = "phone" | "email" | "line" | "qr" | "sns" | "url" | "contact_url";

export const CONTACT_FLAG_LABEL: Record<ContactFlag, string> = {
  phone: "電話番号",
  email: "メールアドレス",
  line: "LINE ID",
  qr: "QRコード",
  sns: "SNSアカウント",
  url: "外部URL",
  contact_url: "外部の連絡用リンク",
};

/** Flags that may not be sent before the contract terms are agreed. */
export const BLOCKED_FLAGS: ReadonlySet<ContactFlag> = new Set(["phone", "email", "line", "sns", "contact_url"]);

export const CONTACT_BLOCK_MESSAGE = "契約手続き前の外部連絡先の共有はできません。ご相談・見積のやりとりはSUMATCH内でお願いします。";

export const CONTACT_WARNING =
  "SUMATCH外での連絡先交換は、保証・成約管理の対象外になる場合があります。やり取りはSUMATCH内で続けることをおすすめします。";

const PHONE = /(?<!\d)(?:\+?81[-\s]?|0)\d{1,4}[-\s()]?\d{1,4}[-\s)]?\d{3,4}(?!\d)/;
const PHONE_DIGITS = /(?<!\d)0\d{9,10}(?!\d)/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
// The LINE app: the Latin word on its own, or ライン/らいん next to an ID / friend / exchange word.
// Plain ライン (a paint line, ラインナップ, ガイドライン) is not a contact.
const LINE = /((?<![A-Za-z])line(?![A-Za-z])|(ライン|らいん)\s*(id|ID|ＩＤ|アイディ|@|＠|交換|追加|友だち|友達|登録|で連絡|でやり取り|でやりとり|で送|に送|教え|やって)|lin\.ee|line\.me)/i;
const QR = /(qr|キューアール)/i;
// An SNS only counts with a handle, a DM / ID / account word, or an @name — "インスタで事例を見ました" is fine.
const SNS_PLATFORM = "(instagram|インスタ|twitter|ツイッター|facebook|フェイスブック|tiktok|ティックトック|x\\(旧twitter\\))";
const SNS = new RegExp(`${SNS_PLATFORM}[\\s\\S]{0,8}?(dm|ＤＭ|id|ＩＤ|アカウント|フォロー|@|＠|で連絡|でやり取り|でやりとり|に送|メッセージ)|@[A-Za-z0-9_.]{3,}(?![A-Za-z0-9.-]*\\.[A-Za-z]{2,})`, "i");
const URL_RE = /https?:\/\/[^\s]+/gi;
const CONTACT_LINK = /(mailto:|tel:|(?<![A-Za-z0-9-])(line\.me|lin\.ee|instagram\.com|instagr\.am|facebook\.com|fb\.me|m\.me\/|messenger\.com|x\.com|twitter\.com|tiktok\.com|wa\.me|whatsapp\.com|t\.me\/|telegram\.me|linktr\.ee|lit\.link|forms\.gle|docs\.google\.com\/forms))/i;

const KANJI_DIGITS: Record<string, string> = {
  "〇": "0", 零: "0", 一: "1", 二: "2", 三: "3", 四: "4", 五: "5", 六: "6", 七: "7", 八: "8", 九: "9",
};

/** Normalise full-width characters, Japanese dashes, kanji digits and spelled-out "@"/"." so tricks are caught. */
export function normalizeForDetection(text: string) {
  let t = text.normalize("NFKC");
  t = t.replace(/[‐‑‒–—―ー−ｰ](?=\s*\d)|(?<=\d\s*)[‐‑‒–—―ー−ｰ]/g, "-");
  // Only convert kanji digits when they appear in runs (avoid touching normal words).
  t = t.replace(/[〇零一二三四五六七八九]{3,}/g, (run) => run.split("").map((c) => KANJI_DIGITS[c] ?? c).join(""));
  // taro アット example ドット com  →  taro@example.com
  t = t.replace(/(?<=[A-Za-z0-9])\s*(アット|あっと|\(at\)|\[at\])\s*(?=[A-Za-z0-9])/gi, "@");
  t = t.replace(/(?<=[A-Za-z0-9])\s*(ドット|どっと|\(dot\)|\[dot\])\s*(?=[A-Za-z0-9])/gi, ".");
  return t;
}

export function detectContactInfo(text: string): ContactFlag[] {
  const t = normalizeForDetection(text);
  const flags = new Set<ContactFlag>();
  const digitsOnly = t.replace(/[\s\-()]/g, "");
  if (PHONE.test(t) || PHONE_DIGITS.test(digitsOnly)) flags.add("phone");
  if (EMAIL.test(t) || /mailto:/i.test(t)) flags.add("email");
  if (LINE.test(t)) flags.add("line");
  if (QR.test(t)) flags.add("qr");
  if (!flags.has("email") && SNS.test(t)) flags.add("sns");
  for (const u of t.match(URL_RE) ?? []) flags.add(CONTACT_LINK.test(u) ? "contact_url" : "url");
  if (/(^|\s)(tel:|mailto:)/i.test(t) || CONTACT_LINK.test(t.replace(URL_RE, ""))) flags.add("contact_url");
  return [...flags];
}

/** The subset of flags that must not be sent before the contract terms are agreed. */
export function blockedFlags(flags: ContactFlag[]): ContactFlag[] {
  return flags.filter((f) => BLOCKED_FLAGS.has(f));
}
