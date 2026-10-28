import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Empty, ErrorState, LoadingList, Pill, Row, Segmented, StatusPill, T, useConfirm, useToast } from '@/components/ui';
import { call, toMessage, useRpc } from '@/lib/api';
import { PAYMENT_LABEL, rangeLabel, yen } from '@/lib/format';
import { AdminPage } from '@/screens/AdminKit';
import { space } from '@/theme/tokens';

type B = { id: string; status: string; start_at: string; end_at: string; price: number; area: string; man_name: string; woman_name: string; payment_status: string | null; refund_status: string | null; created_at: string };

export default function AdminBookings() {
  const [status, setStatus] = useState<'' | 'requested' | 'accepted' | 'completed' | 'canceled' | 'disputed'>('');
  const res = useRpc<B[]>('admin_list_bookings', { p_status: status || null });
  const toast = useToast();
  const confirm = useConfirm();
  const resolve = async (id: string, outcome: 'complete' | 'cancel' | 'refund') => {
    const label = { complete: '完了として確定', cancel: 'キャンセル（請求なし）', refund: 'キャンセルして返金' }[outcome];
    const r = await confirm({ title: `${label}しますか？`, confirm: '実行する', danger: outcome !== 'complete', input: { label: '対応メモ（監査ログに記録）', required: true } });
    if (!r.ok) return;
    try {
      await call('admin_resolve_dispute', { p_booking: id, p_outcome: outcome, p_note: r.text });
      toast('申立てを処理しました');
      res.reload();
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  return (
    <AdminPage title="予約・申立て" subtitle="キャンセル・返金の検討状況を含む" refreshing={res.refreshing} onRefresh={res.refresh}>
      <Segmented value={status} onChange={setStatus} options={[
        { value: '', label: 'すべて' }, { value: 'requested', label: '申請' }, { value: 'accepted', label: '確定' },
        { value: 'completed', label: '完了' }, { value: 'canceled', label: 'キャンセル' }, { value: 'disputed', label: '申立て' },
      ]} />
      <View style={{ marginTop: space.lg, gap: space.md }}>
        {res.loading ? <LoadingList /> : res.error ? <ErrorState message={res.error} onRetry={res.reload} /> : !res.data?.length ? <Empty icon="calendar" title="該当する予約はありません" /> : res.data.map((b) => (
          <Card key={b.id}>
            <Row style={{ justifyContent: 'space-between' }} wrap>
              <View style={{ flexShrink: 1 }}>
                <T v="h3">{b.man_name} → {b.woman_name}</T>
                <T v="small">{rangeLabel(b.start_at, b.end_at)} ・ {b.area} ・ {yen(b.price)}</T>
                <Row gap={6} style={{ marginTop: 4 }} wrap>
                  {b.payment_status ? <Pill label={`決済: ${PAYMENT_LABEL[b.payment_status]}`} /> : null}
                  {b.refund_status ? <Pill label={`返金: ${b.refund_status}`} tone="gold" /> : null}
                </Row>
              </View>
              <StatusPill status={b.status} />
            </Row>
            {b.status === 'disputed' ? (
              <Row gap={space.sm} style={{ marginTop: space.md }} wrap>
                <Button small title="完了として確定" onPress={() => resolve(b.id, 'complete')} />
                <Button small variant="quiet" title="キャンセル" onPress={() => resolve(b.id, 'cancel')} />
                <Button small variant="danger" title="返金" onPress={() => resolve(b.id, 'refund')} />
              </Row>
            ) : null}
          </Card>
        ))}
      </View>
    </AdminPage>
  );
}
