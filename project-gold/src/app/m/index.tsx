import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Grid, TopBar, VerifyBanner, WomanCard } from '@/components/blocks';
import { Icon } from '@/components/Icon';
import { Button, Chip, Empty, ErrorState, LoadingList, Meter, RankBadge, Row, Screen, Section, Skeleton, T } from '@/components/ui';
import { useRpc } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { yen } from '@/lib/format';
import type { MembershipOverview, RankRule, WomanCard as W } from '@/lib/types';
import { colors, radius, space } from '@/theme/tokens';

const AREAS = ['銀座', '六本木', '新宿', '渋谷', '恵比寿', '表参道'];
const RANK_NOTE: Record<string, string> = { S: '最上位', A: '上位', B: '人気', C: '気軽に' };

export default function ManHome() {
  const { me, refreshMe } = useAuth();
  const women = useRpc<W[]>('search_women', { p_limit: 24 });
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
  const list = women.data ?? [];
  // おすすめ: 今すぐ申し込める方を先に、ロック中の方はその後ろに並べる
  const picks = [...list.filter((w) => !w.locked), ...list.filter((w) => w.locked)].slice(0, 8);
  const withSlots = list.filter((w) => w.next_slot);
  return (
    <>
      <TopBar />
      <Screen refreshing={women.refreshing} onRefresh={() => { women.refresh(); ov.reload(); refreshMe(); }} wide>
        <T v="h2" style={{ marginTop: space.xs }}>{greet}、{me.display_name}さん</T>
        <VerifyBanner me={me} />
        {ov.data ? <MemberStrip ov={ov.data} /> : <Skeleton h={64} style={{ marginTop: space.md }} />}

        <Section title="PICK UP ・ おすすめの方" action={<Button small variant="ghost" title="さがす" onPress={() => router.push('/m/search')} />}>
          {women.loading ? <LoadingList count={1} h={240} /> : women.error ? <ErrorState message={women.error} onRetry={women.reload} /> : picks.length === 0 ? (
            <Empty icon="search" title="表示できる方がいません" text="時間をおいて、もう一度お試しください。" />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingHorizontal: space.lg }} style={styles.bleed}>
              {picks.map((w) => <WomanCard key={w.id} w={w} width={156} />)}
            </ScrollView>
          )}
        </Section>

        {ov.data ? <RankFinder rules={ov.data.rank_rules} unlockedSort={ov.data.access.unlocked_sort} /> : null}

        <Section title="AVAILABLE SOON ・ 近日空きあり" action={<Button small variant="ghost" title="すべて見る" onPress={() => router.push('/m/search')} />}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }} style={[styles.bleed, { marginBottom: space.md }]}>
            {AREAS.map((a) => <Chip key={a} label={a} icon="pin" onPress={() => router.push({ pathname: '/m/search', params: { area: a } })} />)}
          </ScrollView>
          {women.loading ? <LoadingList count={2} h={260} /> : women.error ? null : withSlots.length === 0 ? (
            <Empty icon="calendar" title="現在、空き枠のある方はいません" text="条件を変えてさがしてみてください。" />
          ) : (
            <Grid items={withSlots.slice(0, 8)} render={(w, width) => <WomanCard key={w.id} w={w} width={width} />} />
          )}
        </Section>
      </Screen>
    </>
  );
}

/** 会員カード（コンパクト）：今申し込めるランク・確定利用額・次の解放までの残り・プランでの解放ルート */
function MemberStrip({ ov }: { ov: MembershipOverview }) {
  const next = ov.next_spend_rank;
  const prev = ov.rank_rules.filter((r) => r.min_value <= ov.spend_total).pop();
  const top = ov.access.unlocked_sort >= Math.max(...ov.rank_rules.map((r) => r.sort));
  return (
    <Pressable
      testID="member-card"
      accessibilityRole="button"
      accessibilityLabel={`会員ステータス。${ov.access.unlocked_rank}ランクまで申し込みできます`}
      onPress={() => router.push('/membership')}
      style={({ pressed }) => [styles.member, pressed && { opacity: 0.9 }]}>
      <Row gap={space.md}>
        <RankBadge code={ov.access.unlocked_rank} size="md" />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="h3" style={{ fontSize: 14.5 }}>{ov.access.unlocked_rank}ランクまで申し込み可</T>
          <T v="small" numberOfLines={1}>{ov.access.plan_code} プラン ・ 確定利用額 {yen(ov.spend_total)}{ov.payment_mode === 'sandbox' ? '（デモ）' : ''}</T>
        </View>
        <Icon name="chevron-right" size={18} color={colors.faint} />
      </Row>
      {!top ? (
        <View style={{ marginTop: space.md }}>
          <Meter
            value={ov.spend_total - Number(prev?.min_value ?? 0)}
            max={next ? next.min_value - Number(prev?.min_value ?? 0) : 1}
            complete={!next}
            height={5}
            left={next ? `利用実績で ${next.code} まで あと ${yen(next.min_value - ov.spend_total)}` : '利用実績ランクは最上位です'}
            right="プランでも解放可"
          />
        </View>
      ) : null}
    </Pressable>
  );
}

/** ランクから探す：解放済みかどうかが一目で分かるタイル */
function RankFinder({ rules, unlockedSort }: { rules: RankRule[]; unlockedSort: number }) {
  const sorted = [...rules].sort((a, b) => b.sort - a.sort);
  return (
    <Section title="BY RANK ・ ランクから探す">
      <Row gap={space.sm}>
        {sorted.map((r) => {
          const open = r.sort <= unlockedSort;
          return (
            <Pressable
              key={r.code}
              testID={`rank-${r.code}`}
              accessibilityRole="button"
              accessibilityLabel={`${r.code}ランクの方を探す${open ? '' : '（申し込みにはランク解放が必要）'}`}
              onPress={() => router.push({ pathname: '/m/search', params: { rank: r.code } })}
              style={({ pressed }) => [styles.rankTile, open && styles.rankTileOpen, pressed && { opacity: 0.85 }]}>
              <RankBadge code={r.code} size="sm" locked={!open} />
              <T v="small" numberOfLines={1} style={{ fontSize: 11 }}>{RANK_NOTE[r.code] ?? r.label}</T>
              <Row gap={3}>
                <Icon name={open ? 'unlock' : 'lock'} size={11} color={open ? colors.goldDeep : colors.faint} />
                <T v="small" style={{ fontSize: 11, fontWeight: '600' }} color={open ? colors.goldDeep : colors.faint}>{open ? '申込可' : '要解放'}</T>
              </Row>
            </Pressable>
          );
        })}
      </Row>
    </Section>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -space.lg },
  member: { marginTop: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  rankTile: { flex: 1, minHeight: 88, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: space.sm, paddingHorizontal: 4, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  rankTileOpen: { borderColor: colors.goldLight, backgroundColor: colors.goldWash },
});
