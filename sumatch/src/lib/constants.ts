import type { ProjectStatus } from "./types";

export const HOUSE_TYPES = ["戸建て", "マンション", "アパート・集合住宅", "店舗・事務所", "その他"] as const;

export const TIMINGS = [
  { value: "asap", label: "すぐ", weeks: 4 },
  { value: "3m", label: "3ヶ月以内", weeks: 12 },
  { value: "6m", label: "半年以内", weeks: 26 },
  { value: "undecided", label: "まだ決めていない", weeks: 52 },
] as const;

export const BUDGETS = [
  { value: "0-50", label: "〜50万円", min: 0, max: 500000 },
  { value: "50-100", label: "50〜100万円", min: 500000, max: 1000000 },
  { value: "100-200", label: "100〜200万円", min: 1000000, max: 2000000 },
  { value: "200-", label: "200万円〜", min: 2000000, max: null },
  { value: "unknown", label: "まだ分からない", min: null, max: null },
] as const;

/** Shown in the question flow; HOUSE_TYPES keeps the full list for data. */
export const HOUSE_CHOICES = ["戸建て", "マンション", "その他"] as const;

export const CONTACT_TIMES = ["平日 日中", "平日 夕方以降", "土日祝", "いつでも可"] as const;

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; step: number }> = {
  consulting: { label: "相談中", step: 0 },
  quoting: { label: "見積中", step: 1 },
  comparing: { label: "比較中", step: 2 },
  contracted: { label: "契約", step: 3 },
  in_progress: { label: "工事中", step: 4 },
  completed: { label: "完了", step: 5 },
  cancelled: { label: "キャンセル", step: -1 },
};

export const STATUS_FLOW: ProjectStatus[] = [
  "consulting",
  "quoting",
  "comparing",
  "contracted",
  "in_progress",
  "completed",
];

/** Maximum number of companies a customer can ask to talk to per project. */
export const MAX_MATCHES_PER_PROJECT = 3;
/** Number of candidates shown up-front. */
export const CANDIDATES_SHOWN = 3;
export const TAX_RATE = 0.1;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_PROJECT_PHOTOS = 10;

export const REPORT_REASONS = [
  "外部連絡先への誘導",
  "不適切な言動",
  "しつこい営業",
  "虚偽の情報",
  "その他",
] as const;

export const CHAT_TEMPLATES = {
  company: [
    "お問い合わせありがとうございます。担当の{name}です。現地調査のご希望日時を2〜3候補いただけますでしょうか。",
    "お写真ありがとうございます。拝見した限りでは、{category}の一般的な工事で対応可能かと思います。正式なお見積は現地確認後にSUMATCH上でお送りします。",
    "お見積をSUMATCH上で提出しました。ご不明点があればこちらのチャットでお気軽にご質問ください。",
    "現地調査の日程が確定しました。当日はよろしくお願いいたします。",
  ],
  customer: [
    "はじめまして。よろしくお願いします。",
    "現地調査をお願いしたいです。候補日をいくつか教えてください。",
    "お見積の内訳について、もう少し詳しく教えてください。",
    "追加費用が発生する可能性はありますか？",
  ],
} as const;

export const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;
