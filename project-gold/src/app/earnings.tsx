import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Divider, Empty, ErrorState, Header, LoadingList, Notice, Pill, Row, Screen, Section, Stat, T } from '@/components/ui';
import { useRpc } from '@/lib/api';
import { dateLabel, yen } from '@/lib/format';
import { space } from '@/theme/tokens';

type Earnings = {
  total_net: number; total_gross: number; total_fee: number; fee_rate: number; is_sandbox: boolean;
  entries: { id: number; type: 'earning' | 'reversal' | 'payout'; gross: number; fee: number; net: number; is_sandbox: boolean; created_at: string; booking_id: string | null; start_at: string | null; man_name: string | null }[];
};

export default function EarningsScreen() {
  const res = useRpc<Earnings>('get_earnings');
  const e = res.data;
  return (
    <>
      <Header title="報酬・履歴" />
      <Screen refreshing={res.refreshing} onRefresh={res.refresh}>
        {res.loading ? <LoadingList /> : res.error || !e ? <ErrorState message={res.error ?? ''} onRetry={res.reload} /> : (
          <>
            {e.is_sandbox ? <Notice icon="info" title="デモ表示（疑似決済）">表示中の報酬はサンドボックスの記録です。実際の送金は、決済事業者との契約・法令確認が完了してから提供します。</Notice> : null}
            <Card style={{ marginTop: space.lg }}>
              <T v="caption">CONFIRMED EARNINGS</T>
              <T v="num" style={{ fontSize: 36, marginTop: space.sm }}>{yen(e.total_net)}</T>
              <T v="small">アプリ内の確定報酬（手数料控除後・返金反映済み）</T>
              <Divider style={{ marginVertical: space.lg }} />
              <Row gap={space.lg}>
                <Stat label="予約金額の合計" value={yen(e.total_gross)} />
                <Stat label={`手数料（${Math.round(Number(e.fee_rate) * 100)}%・仮）`} value={yen(e.total_fee)} />
              </Row>
            </Card>
            <Section title="LEDGER ・ 台帳">
              {!e.entries.length ? <Empty icon="yen" title="まだ報酬はありません" text="予約が完了すると、ここに記録されます。" /> : (
                <Card padded={false}>
                  {e.entries.map((x, i) => (
                    <View key={x.id}>
                      {i > 0 ? <Divider /> : null}
                      <Row style={{ padding: space.lg, justifyContent: 'space-between' }}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Row gap={6}>
                            <T v="body">{x.type === 'earning' ? '予約完了' : x.type === 'reversal' ? '返金による取消' : '送金'}</T>
                            {x.is_sandbox ? <Pill label="デモ" /> : null}
                          </Row>
                          <T v="small">{dateLabel(x.created_at)}{x.man_name ? ` ・ ${x.man_name}さん` : ''}</T>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <T v="h3">{x.net < 0 ? '−' : ''}{yen(Math.abs(x.net))}</T>
                          <T v="small">手数料 {yen(Math.abs(x.fee))}</T>
                        </View>
                      </Row>
                    </View>
                  ))}
                </Card>
              )}
            </Section>
            <T v="small" style={{ marginTop: space.lg }} >ランク計算には、このアプリ内の確定報酬のみを使用します（店舗での売上額は使用しません）。</T>
            <Button small variant="ghost" title="報酬について問い合わせる" onPress={() => router.push('/support')} style={{ marginTop: space.sm }} />
          </>
        )}
      </Screen>
    </>
  );
}
