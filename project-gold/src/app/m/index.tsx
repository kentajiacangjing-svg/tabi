import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, View } from 'react-native';

import { Grid, TopBar, VerifyBanner, WomanCard } from '@/components/blocks';
import { Card, Chip, Empty, ErrorState, LoadingList, Meter, RankBadge, Row, Screen, Section, T, Button } from '@/components/ui';
import { useRpc } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { yen } from '@/lib/format';
import type { MembershipOverview, WomanCard as W } from '@/lib/types';
import { colors, space } from '@/theme/tokens';

const AREAS = ['銀座', '六本木', '新宿', '渋谷', '恵比寿', '表参道'];

export default function ManHome() {
  const { me, refreshMe } = useAuth();
  const women = useRpc<W[]>('search_women', { p_limit: 12 });
  const ov = useRpc<MembershipOverview>('membership_overview');
  const reloadWomen = women.reload;
  const reloadOv = ov.reload;
  useFocusEffect(useCallback(() => {
    reloadWomen();
    reloadOv();
    refreshMe();
  }, [reloadWomen, reloadOv, refreshMe]));
  if (!me) return null;
  const hour = (new Date().getUTCHours() + 9) % 24;
  const greet = hour < 5 ? 'こんばんは' : hour < 11 ? 'おはようございます' : hour < 18 ? 'こんにちは' : 'こんばんは';
  const withSlots = (women.data ?? []).filter((w) => w.next_slot);
  return (
    <>
      <TopBar />
      <Screen refreshing={women.refreshing} onRefresh={() => { women.refresh(); ov.reload(); refreshMe(); }} wide>
        <T v="title" style={{ marginTop: space.sm }}>{greet}、{me.display_name}さん</T>
        <VerifyBanner me={me} />

        {ov.data ? <StatusCard ov={ov.data} /> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space.xl }} contentContainerStyle={{ gap: space.sm }}>
          {AREAS.map((a) => <Chip key={a} label={a} icon="pin" onPress={() => router.push({ pathname: '/m/search', params: { area: a } })} />)}
        </ScrollView>

        <Section title="AVAILABLE SOON ・ 近日空きのある方" action={<Button small variant="ghost" title="すべて見る" onPress={() => router.push('/m/search')} />}>
          {women.loading ? <LoadingList count={2} h={260} /> : women.error ? <ErrorState message={women.error} onRetry={women.reload} /> : withSlots.length === 0 ? (
            <Empty icon="calendar" title="現在、空き枠のある方はいません" text="条件を変えてさがしてみてください。" />
          ) : (
            <Grid items={withSlots.slice(0, 8)} render={(w, width) => <WomanCard key={w.id} w={w} width={width} />} />
          )}
        </Section>
      </Screen>
    </>
  );
}

function StatusCard({ ov }: { ov: MembershipOverview }) {
  const next = ov.next_spend_rank;
  const prev = ov.rank_rules.filter((r) => r.min_value <= ov.spend_total).pop();
  return (
    <Card style={{ marginTop: space.lg }} onPress={() => router.push('/membership')} accessibilityLabel="会員ステータス">
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <T v="caption">MEMBER STATUS</T>
          <T v="h2" style={{ marginTop: 4 }}>{ov.access.plan_code} プラン</T>
        </View>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <RankBadge code={ov.access.unlocked_rank} size="lg" />
          <T v="small">まで申し込み可</T>
        </View>
      </Row>
      <View style={{ marginTop: space.lg }}>
        <Meter
          value={ov.spend_total - Number(prev?.min_value ?? 0)}
          max={next ? next.min_value - Number(prev?.min_value ?? 0) : 1}
          label={next ? `利用実績で ${next.code} ランク解放まで あと ${yen(next.min_value - ov.spend_total)}` : '利用実績ランクは最上位です'}
          left={`確定利用額 ${yen(ov.spend_total)}`}
          right={`Lv.${ov.level}`}
        />
      </View>
      {ov.payment_mode === 'sandbox' ? <T v="small" style={{ marginTop: space.sm }} color={colors.goldDeep}>※ サンドボックス（疑似決済）の実績を含むデモ表示です</T> : null}
    </Card>
  );
}
