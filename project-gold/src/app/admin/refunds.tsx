import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Empty, ErrorState, LoadingList, Row, Segmented, T, useConfirm, useToast } from '@/components/ui';
import { call, toMessage, useRpc } from '@/lib/api';
import { relative, yen } from '@/lib/format';
import { AdminPage, STATUS_PILL } from '@/screens/AdminKit';
import { space } from '@/theme/tokens';

type R = { id: string; amount: number; reason: string; status: string; booking_id: string | null; requested_by: string | null; created_at: string };

export default function Refunds() {
  const [status, setStatus] = useState<'' | 'requested' | 'processed' | 'rejected'>('requested');
  const res = useRpc<R[]>('admin_list_refunds', { p_status: status || null });
  const toast = useToast();
  const confirm = useConfirm();
  const decide = async (id: string, approve: boolean) => {
    const r = await confirm({ title: approve ? '返金を承認しますか？' : '返金申請を却下しますか？', message: approve ? '決済を返金済みにし、女性の報酬台帳に取消を記録、利用額・ランクを再計算します（サンドボックス）。' : undefined, confirm: approve ? '承認する' : '却下する', danger: !approve });
    if (!r.ok) return;
    try {
      res.setData(await call<R[]>('admin_decide_refund', { p_id: id, p_approve: approve }));
      toast('処理しました');
      res.reload();
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  return (
    <AdminPage title="返金" subtitle="返金ルールは仮設定。本番前に確定" refreshing={res.refreshing} onRefresh={res.refresh}>
      <Segmented value={status} onChange={setStatus} options={[{ value: 'requested', label: '申請中' }, { value: 'processed', label: '処理済み' }, { value: 'rejected', label: '却下' }, { value: '', label: 'すべて' }]} />
      <View style={{ marginTop: space.lg, gap: space.md }}>
        {res.loading ? <LoadingList /> : res.error ? <ErrorState message={res.error} onRetry={res.reload} /> : !res.data?.length ? <Empty icon="refresh" title="該当する返金はありません" /> : res.data.map((r) => (
          <Card key={r.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h3">{yen(r.amount)}</T>
              {STATUS_PILL(r.status)}
            </Row>
            <T v="small">{r.requested_by} ・ {relative(r.created_at)}</T>
            {r.reason ? <T v="body" style={{ marginTop: space.sm }}>{r.reason}</T> : null}
            {r.status === 'requested' ? (
              <Row gap={space.sm} style={{ marginTop: space.md }}>
                <Button small title="承認（返金）" onPress={() => decide(r.id, true)} />
                <Button small variant="quiet" title="却下" onPress={() => decide(r.id, false)} />
              </Row>
            ) : null}
          </Card>
        ))}
      </View>
    </AdminPage>
  );
}
