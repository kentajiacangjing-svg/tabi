export function yen(n: number | null | undefined) {
  if (n == null) return "—";
  return `${Math.round(n).toLocaleString("ja-JP")}円`;
}

/** 1,180,000 -> "118万円" */
export function man(n: number | null | undefined, digits = 0) {
  if (n == null) return "—";
  const v = n / 10000;
  const s = digits ? v.toFixed(digits).replace(/\.0+$/, "") : Math.round(v).toLocaleString("ja-JP");
  return `${s}万円`;
}

export function manRange(min: number | null | undefined, max: number | null | undefined) {
  if (min == null && max == null) return "未定";
  if (min != null && max == null) return `${man(min)}以上`;
  if (min == null || min === 0) return `${man(max)}以下`;
  return `${Math.round(min / 10000)}〜${man(max)}`;
}

export function dateJa(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function dateShort(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function timeHM(iso: string) {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export function relative(iso: string | null | undefined) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "たった今";
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}日前`;
  return dateShort(iso);
}

export function responseSpeed(minutes: number) {
  if (minutes <= 30) return "30分以内";
  if (minutes <= 60) return "1時間以内";
  if (minutes <= 180) return "3時間以内";
  if (minutes <= 24 * 60) return "1日以内";
  return "2日以上";
}

export function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}
