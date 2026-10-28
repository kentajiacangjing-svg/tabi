const WD = ['日', '月', '火', '水', '木', '金', '土'];

/** 日本時間で表示（端末のタイムゾーンに依存しない） */
function jst(iso: string | Date) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Date(d.getTime() + 9 * 3600 * 1000);
}

export function yen(n: number | null | undefined) {
  if (n === null || n === undefined) return '—';
  return `¥${Math.round(n).toLocaleString('ja-JP')}`;
}

export function dateLabel(iso: string) {
  const d = jst(iso);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${WD[d.getUTCDay()]}）`;
}

export function timeLabel(iso: string) {
  const d = jst(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function rangeLabel(start: string, end: string) {
  return `${dateLabel(start)} ${timeLabel(start)}–${timeLabel(end)}`;
}

export function relative(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'たった今';
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}日前`;
  return dateLabel(iso);
}

export function durationLabel(start: string, end: string) {
  const min = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}時間${m ? `${m}分` : ''}` : `${m}分`;
}

/** JST の日付(0時) + 分 → ISO 文字列 */
export function jstToIso(dayOffset: number, minutes: number) {
  const now = jst(new Date());
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset) - 9 * 3600 * 1000;
  return new Date(base + minutes * 60000).toISOString();
}

export function jstDayLabel(dayOffset: number) {
  const now = jst(new Date());
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset));
  return { md: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`, wd: WD[d.getUTCDay()], iso: d.toISOString().slice(0, 10) };
}

export const STATUS_LABEL: Record<string, string> = {
  requested: '承認待ち',
  accepted: '予約確定',
  declined: '不成立',
  canceled: 'キャンセル',
  completed: '完了',
  disputed: '申立て中',
};

export const PAYMENT_LABEL: Record<string, string> = {
  pending: '処理待ち', authorized: '与信済み', captured: '確定', voided: '取消（請求なし）', refunded: '返金済み', failed: '失敗',
};
