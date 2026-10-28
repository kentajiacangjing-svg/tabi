import { View } from 'react-native';

import { Card, Divider, Empty, ErrorState, LoadingList, Row, T } from '@/components/ui';
import { useRpc } from '@/lib/api';
import { dateLabel, timeLabel } from '@/lib/format';
import { AdminPage } from '@/screens/AdminKit';
import { space } from '@/theme/tokens';

type A = { id: number; action: string; target_type: string; target_id: string; detail: Record<string, unknown>; created_at: string; actor: string | null };

export default function Audit() {
  const res = useRpc<A[]>('admin_list_audit', { p_limit: 200 });
  return (
    <AdminPage title="監査ログ" subtitle="運営操作・設定変更・本人確認・通報の記録" refreshing={res.refreshing} onRefresh={res.refresh}>
      {res.loading ? <LoadingList /> : res.error ? <ErrorState message={res.error} onRetry={res.reload} /> : !res.data?.length ? <Empty icon="list" title="記録はありません" /> : (
        <Card padded={false}>
          {res.data.map((a, i) => (
            <View key={a.id}>
              {i > 0 ? <Divider /> : null}
              <View style={{ padding: space.lg }}>
                <Row style={{ justifyContent: 'space-between' }} wrap>
                  <T v="h3" style={{ fontSize: 14 }}>{a.action}</T>
                  <T v="small">{dateLabel(a.created_at)} {timeLabel(a.created_at)}</T>
                </Row>
                <T v="small" selectable>{a.actor ?? 'system'} → {a.target_type}:{a.target_id.slice(0, 13)} {JSON.stringify(a.detail).slice(0, 240)}</T>
              </View>
            </View>
          ))}
        </Card>
      )}
    </AdminPage>
  );
}
