import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, ErrorState, LoadingList, Notice, Row, Section, T } from '@/components/ui';
import { useRpc } from '@/lib/api';
import { yen } from '@/lib/format';
import { AdminPage, KPI } from '@/screens/AdminKit';
import { space } from '@/theme/tokens';

type Dash = {
  users: { total: number; women: number; men: number; suspended: number; deletion_requested: number; new_7d: number };
  verification_pending: number; venue_pending: number; photos_pending: number; applications: number;
  bookings: Record<string, number>; booking_total: number; success_rate: number | null;
  revenue: { subscription: number; booking_gross: number }; platform_fee: number;
  reports_open: number; disputes_open: number; refunds_open: number; inquiries_open: number; payment_mode: string;
};

export default function AdminDashboard() {
  const d = useRpc<Dash>('admin_dashboard');
  const x = d.data;
  return (
    <AdminPage title="ダッシュボード" subtitle="内部デモ環境の集計（サンドボックス）" refreshing={d.refreshing} onRefresh={d.refresh} action={<Button small variant="quiet" icon="refresh" title="更新" onPress={d.reload} />}>
      {d.loading ? <LoadingList /> : d.error || !x ? <ErrorState message={d.error ?? ''} onRetry={d.reload} /> : (
        <>
          <Notice icon="info" title={`決済モード：${x.payment_mode === 'sandbox' ? 'サンドボックス（疑似決済）' : '本番'}`}>
            売上はすべて{x.payment_mode === 'sandbox' ? '疑似決済による仮の数値です。実際の入金ではありません。' : '本番決済の確定値です。'}
          </Notice>
          <Section title="USERS">
            <Row wrap gap={space.md} style={{ alignItems: 'stretch' }}>
              <KPI label="登録数" value={x.users.total} note={`直近7日 +${x.users.new_7d}`} />
              <KPI label="男女比（女性：男性）" value={`${x.users.women}：${x.users.men}`} />
              <KPI label="停止中" value={x.users.suspended} tone="danger" />
              <KPI label="退会申請" value={x.users.deletion_requested} tone="gold" />
            </Row>
          </Section>
          <Section title="MATCHING">
            <Row wrap gap={space.md} style={{ alignItems: 'stretch' }}>
              <KPI label="予約申込数" value={x.booking_total} note={`プロフィール申請 ${x.applications}`} />
              <KPI label="成立率" value={x.success_rate === null ? '—' : `${x.success_rate}%`} note="承認・完了 ÷ 処理済み" />
              <KPI label="確定（予定）" value={x.bookings.accepted ?? 0} note={`完了 ${x.bookings.completed ?? 0}`} />
              <KPI label="申立て中" value={x.disputes_open} tone="danger" />
            </Row>
          </Section>
          <Section title="REVENUE ・ 仮売上">
            <Row wrap gap={space.md} style={{ alignItems: 'stretch' }}>
              <KPI label="サブスク" value={yen(x.revenue.subscription)} note="デモ" />
              <KPI label="予約取扱高" value={yen(x.revenue.booking_gross)} note="デモ" />
              <KPI label="手数料収入" value={yen(x.platform_fee)} note="デモ" />
            </Row>
          </Section>
          <Section title="QUEUE ・ 対応待ち">
            <Row wrap gap={space.md} style={{ alignItems: 'stretch' }}>
              <QueueCard label="本人確認" n={x.verification_pending} onPress={() => router.push('/admin/review')} />
              <QueueCard label="店舗確認" n={x.venue_pending} onPress={() => router.push('/admin/review')} />
              <QueueCard label="写真審査" n={x.photos_pending} onPress={() => router.push('/admin/review')} />
              <QueueCard label="通報" n={x.reports_open} onPress={() => router.push('/admin/reports')} />
              <QueueCard label="返金申請" n={x.refunds_open} onPress={() => router.push('/admin/refunds')} />
              <QueueCard label="問い合わせ" n={x.inquiries_open} onPress={() => router.push('/admin/inquiries')} />
            </Row>
          </Section>
        </>
      )}
    </AdminPage>
  );
}

function QueueCard({ label, n, onPress }: { label: string; n: number; onPress: () => void }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 150 }}>
      <Card onPress={onPress} accessibilityLabel={label}>
        <T v="small">{label}</T>
        <T v="num" style={{ fontSize: 26 }}>{n}</T>
        <T v="small">{n > 0 ? '対応が必要です' : '対応待ちなし'}</T>
      </Card>
    </View>
  );
}
