import { View } from 'react-native';

import { Card, Divider, ErrorState, LoadingList, Notice, Pill, Row, Section, T } from '@/components/ui';
import { useRpc } from '@/lib/api';
import { AdminPage, KV } from '@/screens/AdminKit';
import { space } from '@/theme/tokens';

type P = { payment_mode: string; providers: { name: string; status: string; note: string }[]; counts: Record<string, number> | null; sandbox_payments: number; live_payments: number };

export default function Payments() {
  const res = useRpc<P>('admin_payment_status');
  const x = res.data;
  return (
    <AdminPage title="決済連携" subtitle="デモ（サンドボックス）と本番を明確に区別" refreshing={res.refreshing} onRefresh={res.refresh}>
      {res.loading ? <LoadingList /> : res.error || !x ? <ErrorState message={res.error ?? ''} onRetry={res.reload} /> : (
        <>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h2">現在のモード</T>
              <Pill label={x.payment_mode === 'sandbox' ? 'SANDBOX（疑似決済）' : 'LIVE'} tone={x.payment_mode === 'sandbox' ? 'gold' : 'danger'} />
            </Row>
            <KV k="サンドボックス決済件数" v={x.sandbox_payments} />
            <KV k="本番決済件数" v={x.live_payments} />
          </Card>
          <View style={{ marginTop: space.md }}>
            <Notice tone="danger" icon="alert" title="本番決済は未設定です">
              決済事業者・ストアの審査、特定商取引法の表示、法令確認が完了するまで本番課金と女性への送金は稼働させないでください。payment_mode を live に変更しても、承認済み事業者のアダプターが実装・設定されるまで予約確定・課金はサーバー側で拒否されます。
            </Notice>
          </View>
          <Section title="PROVIDERS">
            <Card padded={false}>
              {x.providers.map((p, i) => (
                <View key={p.name}>
                  {i > 0 ? <Divider /> : null}
                  <View style={{ padding: space.lg }}>
                    <Row style={{ justifyContent: 'space-between' }} wrap>
                      <T v="h3">{p.name}</T>
                      <Pill label={p.status === 'active' ? '稼働中' : '未設定'} tone={p.status === 'active' ? 'success' : 'neutral'} />
                    </Row>
                    <T v="small">{p.note}</T>
                  </View>
                </View>
              ))}
            </Card>
          </Section>
          <Section title="COUNTS">
            <Card>{Object.entries(x.counts ?? {}).map(([k, v]) => <KV key={k} k={k} v={v} />)}</Card>
          </Section>
        </>
      )}
    </AdminPage>
  );
}
