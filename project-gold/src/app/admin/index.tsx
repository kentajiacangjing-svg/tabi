import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Button, Card, Disclosure, ErrorState, LoadingList, Pill, Row, Section, T } from '@/components/ui';
import { useRpc } from '@/lib/api';
import { yen } from '@/lib/format';
import { AdminPage, KPI } from '@/screens/AdminKit';
import { colors, radius, space } from '@/theme/tokens';

type Dash = {
  users: { total: number; women: number; men: number; suspended: number; deletion_requested: number; new_7d: number };
  verification_pending: number; venue_pending: number; photos_pending: number;
  applications: { total: number; pending: number; approved: number };
  bookings: { requested: number; accepted: number; completed: number; declined: number; canceled: number; disputed: number };
  booking_total: number; success_rate: number | null;
  payments: { authorized: number; captured: number; voided: number; refunded: number };
  revenue: { subscription: number; booking_gross: number; refunded: number }; platform_fee: number;
  reports_open: number; disputes_open: number; refunds_open: number; inquiries_open: number; payment_mode: string; is_sandbox: boolean;
};

/** 予約ステータスの定義（画面間で同じ言葉を使う） */
const BOOKING_STATES: { k: keyof Dash['bookings']; label: string; def: string }[] = [
  { k: 'requested', label: '承認待ち', def: '男性が申し込み、女性の判断を待っている' },
  { k: 'accepted', label: '予約確定', def: '女性が承認。与信済み・まだ完了していない' },
  { k: 'completed', label: '完了', def: '実施済み。決済確定・利用額と報酬に計上' },
  { k: 'declined', label: '不成立', def: '女性が見送った（理由は任意）' },
  { k: 'canceled', label: 'キャンセル', def: '申込者・女性・運営による取り消し' },
  { k: 'disputed', label: '申立て中', def: '問題の申告あり。運営の判断待ち（報酬は保留）' },
];

export default function AdminDashboard() {
  const d = useRpc<Dash>('admin_dashboard');
  const x = d.data;
  const demo = x?.is_sandbox ?? true;
  return (
    <AdminPage title="ダッシュボード" subtitle="対応待ち → 利用状況 → 仮売上 の順に表示" refreshing={d.refreshing} onRefresh={d.refresh} action={<Button small variant="quiet" icon="refresh" title="更新" onPress={d.reload} />}>
      {d.loading ? <LoadingList /> : d.error || !x ? <ErrorState message={d.error ?? ''} onRetry={d.reload} /> : (
        <>
          <Row gap={space.sm} wrap>
            <Pill label={demo ? 'デモ環境・サンドボックス決済' : '本番決済'} tone={demo ? 'gold' : 'danger'} icon="info" />
            <T v="small">{demo ? '金額はすべて疑似決済による仮の数値で、実際の入金ではありません。' : '本番決済の確定値です。'}</T>
          </Row>

          <Section title="QUEUE ・ 対応待ち">
            <View style={styles.queue}>
              <Queue icon="shield" label="本人確認" n={x.verification_pending} onPress={() => router.push('/admin/review')} testID="q-verify" />
              <Queue icon="image" label="写真審査" n={x.photos_pending} onPress={() => router.push('/admin/review')} />
              <Queue icon="store" label="店舗確認" n={x.venue_pending} onPress={() => router.push('/admin/review')} />
              <Queue icon="flag" label="通報" n={x.reports_open} onPress={() => router.push('/admin/reports')} urgent />
              <Queue icon="alert" label="申立て" n={x.disputes_open} onPress={() => router.push('/admin/bookings')} urgent />
              <Queue icon="yen" label="返金申請" n={x.refunds_open} onPress={() => router.push('/admin/refunds')} />
              <Queue icon="chat" label="問い合わせ" n={x.inquiries_open} onPress={() => router.push('/admin/inquiries')} />
            </View>
          </Section>

          <Section title="USERS ・ 会員">
            <Row wrap gap={space.md} style={{ alignItems: 'stretch' }}>
              <KPI label="会員数（運営を除く）" value={x.users.total} note={`直近7日 +${x.users.new_7d}`} />
              <KPI label="女性 ／ 男性" value={`${x.users.women} ／ ${x.users.men}`} />
              <KPI label="停止中" value={x.users.suspended} tone="danger" />
              <KPI label="退会申請" value={x.users.deletion_requested} tone="gold" />
            </Row>
          </Section>

          <Section title="BOOKINGS ・ 予約">
            <Card>
              <Row wrap gap={space.sm}>
                {BOOKING_STATES.map((s) => (
                  <View key={s.k} style={styles.state} testID={`bk-${s.k}`}>
                    <T v="small">{s.label}</T>
                    <T v="h2" style={{ fontVariant: ['tabular-nums'], color: s.k === 'disputed' && x.bookings[s.k] > 0 ? colors.danger : colors.text }}>{x.bookings[s.k]}</T>
                  </View>
                ))}
              </Row>
              <Row wrap gap={space.lg} style={{ marginTop: space.md }}>
                <T v="small">予約申込 合計 {x.booking_total}件</T>
                <T v="small">成立率 {x.success_rate === null ? '—' : `${x.success_rate}%`}</T>
                <T v="small">プロフィール申請 {x.applications.total}件（承認待ち {x.applications.pending}・承認 {x.applications.approved}）</T>
              </Row>
              <View style={{ marginTop: space.md }}>
                <Disclosure title="ステータスと指標の定義" testID="defs">
                  <View style={{ gap: 6 }}>
                    {BOOKING_STATES.map((s) => <T key={s.k} v="small"><T v="small" color={colors.text} style={{ fontWeight: '600' }}>{s.label}</T>：{s.def}</T>)}
                    <T v="small"><T v="small" color={colors.text} style={{ fontWeight: '600' }}>成立率</T>：（予約確定＋完了＋申立て中）÷（予約確定＋完了＋不成立＋申立て中）。キャンセルは分母に含めない。</T>
                  </View>
                </Disclosure>
              </View>
            </Card>
          </Section>

          <Section title={`REVENUE ・ ${demo ? '仮売上（デモ）' : '売上'}`}>
            <Row wrap gap={space.md} style={{ alignItems: 'stretch' }}>
              <KPI label={`サブスク${demo ? '（デモ）' : ''}`} value={yen(x.revenue.subscription)} note="決済確定分" />
              <KPI label={`予約取扱高${demo ? '（デモ）' : ''}`} value={yen(x.revenue.booking_gross)} note="完了で決済確定した予約" />
              <KPI label={`手数料収入${demo ? '（デモ）' : ''}`} value={yen(x.platform_fee)} note="報酬台帳の手数料合計" />
              <KPI label={`返金済み${demo ? '（デモ）' : ''}`} value={yen(x.revenue.refunded)} />
            </Row>
            <T v="small" style={{ marginTop: space.sm }}>
              決済の状態：与信のみ {x.payments.authorized} ・ 確定 {x.payments.captured} ・ 取消 {x.payments.voided} ・ 返金 {x.payments.refunded}（与信のみは売上に含めません）
            </T>
          </Section>
        </>
      )}
    </AdminPage>
  );
}

function Queue({ icon, label, n, onPress, urgent, testID }: { icon: IconName; label: string; n: number; onPress: () => void; urgent?: boolean; testID?: string }) {
  const hot = n > 0;
  const tone = hot ? (urgent ? colors.danger : colors.goldDeep) : colors.faint;
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} ${n}件`}
      style={({ pressed }) => [styles.qItem, hot && { borderColor: urgent ? '#E8C3BF' : colors.goldLight, backgroundColor: urgent ? colors.dangerWash : colors.goldWash }, pressed && { opacity: 0.85 }]}>
      <Icon name={icon} size={18} color={tone} />
      <View style={{ flex: 1 }}>
        <T v="small" color={hot ? colors.text : colors.sub} style={{ fontWeight: hot ? '600' : '400' }}>{label}</T>
        <T v="small" style={{ fontSize: 11 }}>{hot ? '対応が必要' : '対応待ちなし'}</T>
      </View>
      <T v="h2" style={{ fontVariant: ['tabular-nums'], color: hot ? tone : colors.faint }}>{n}</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  queue: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  qItem: { flexGrow: 1, flexBasis: 170, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  state: { flexGrow: 1, flexBasis: 96, padding: space.sm, borderRadius: radius.sm, backgroundColor: colors.bg },
});
