import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { Badges, LevelCard, SlotRow, TopBar, VerifyBanner } from '@/components/blocks';
import { Button, Card, Divider, ErrorState, LoadingList, Meter, Notice, Pill, RankBadge, Row, Screen, Section, T } from '@/components/ui';
import { useRpc } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { yen } from '@/lib/format';
import type { WomanDashboard } from '@/lib/types';
import { colors, space } from '@/theme/tokens';

const PARTS: [keyof NonNullable<WomanDashboard['rank_breakdown']>, string][] = [
  ['profile', 'プロフィールの充実'], ['review', '運営の審査'], ['venue', '所属店舗の確認'], ['earnings', 'アプリ内の確定報酬'], ['record', '予約の完了実績'],
];

export default function WomanHome() {
  const { me, refreshMe } = useAuth();
  const d = useRpc<WomanDashboard>('woman_dashboard');
  const { reload } = d;
  useFocusEffect(useCallback(() => { reload(); refreshMe(); }, [reload, refreshMe]));
  if (!me) return null;
  const x = d.data;
  return (
    <>
      <TopBar />
      <Screen refreshing={d.refreshing} onRefresh={() => { d.refresh(); refreshMe(); }}>
        <T v="title" style={{ marginTop: space.sm }}>{me.display_name}さん</T>
        <VerifyBanner me={me} />
        {me.verification.status === 'approved' && !me.woman?.is_published ? (
          <View style={{ marginTop: space.lg }}>
            <Notice icon="info" title="プロフィールは非公開です" action={<Button small variant="outline" title="プロフィールを整える" onPress={() => router.push('/profile')} />}>
              写真を1枚以上登録して公開すると、男性会員の検索に表示されます。
            </Notice>
          </View>
        ) : null}

        {d.loading ? <LoadingList /> : d.error || !x ? <ErrorState message={d.error ?? ''} onRetry={d.reload} /> : (
          <>
            <Row gap={space.md} style={{ marginTop: space.lg, alignItems: 'stretch' }}>
              <Card style={{ flex: 1 }} onPress={() => router.push('/w/requests')} accessibilityLabel="新しい申込">
                <T v="small">新しい申込</T>
                <T v="num">{x.pending_bookings + x.pending_applications}</T>
                <T v="small">予約 {x.pending_bookings} ・ 申請 {x.pending_applications}</T>
              </Card>
              <Card style={{ flex: 1 }} onPress={() => router.push('/earnings')} accessibilityLabel="今月の確定報酬">
                <T v="small">今月の確定報酬</T>
                <T v="num">{yen(x.month_net)}</T>
                {x.is_sandbox ? <T v="small" color={colors.goldDeep}>デモ（疑似決済）</T> : null}
              </Card>
            </Row>

            <Card style={{ marginTop: space.md }} onPress={() => router.push('/accept-settings')} accessibilityLabel="受付モード">
              <Row style={{ justifyContent: 'space-between' }}>
                <View>
                  <T v="small">受付モード</T>
                  <T v="h3">{x.accept_mode === 'open' ? '幅広く受け付ける' : '自分で選ぶ'}</T>
                </View>
                <Pill label={x.accept_requests ? '受付中' : '新規受付を停止中'} tone={x.accept_requests ? 'gold' : 'neutral'} />
              </Row>
              <T v="small" style={{ marginTop: 4 }}>どちらのモードでも、予約はあなたの承認で成立します。</T>
            </Card>

            <Section title="UPCOMING ・ 予定" action={<Button small variant="ghost" title="日程を追加" onPress={() => router.push('/schedule-new')} />}>
              {x.upcoming.length === 0 ? <T v="sub">確定済みの予約はありません。</T> : (
                <Card padded={false} style={{ paddingHorizontal: space.lg }}>
                  {x.upcoming.map((u, i) => (
                    <View key={u.id}>
                      {i > 0 ? <Divider /> : null}
                      <SlotRow start={u.start_at} end={u.end_at} plan={u.plan_type} area={`${u.man_name}さん`} right={<Button small variant="quiet" title="詳細" onPress={() => router.push(`/booking/${u.id}`)} />} />
                    </View>
                  ))}
                </Card>
              )}
            </Section>

            <Section title="RANK ・ ランク">
              <Card>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <T v="h2">現在 {x.rank_code} ランク</T>
                    <T v="small">スコア {Number(x.rank_score).toFixed(1)} / 100</T>
                  </View>
                  <RankBadge code={x.rank_code} size="lg" />
                </Row>
                <View style={{ marginTop: space.lg }}>
                  <Meter value={Number(x.rank_score)} max={x.next_rank?.min_value ?? 100} label={x.next_rank ? `${x.next_rank.code} ランクまで あと ${(x.next_rank.min_value - Number(x.rank_score)).toFixed(1)} pt` : '最上位ランクです'} />
                </View>
                {x.rank_breakdown ? (
                  <View style={{ marginTop: space.lg, gap: 6 }}>
                    {PARTS.map(([k, l]) => (
                      <Row key={k} style={{ justifyContent: 'space-between' }}>
                        <T v="small">{l}</T>
                        <T v="small" style={{ color: colors.text }}>{Number(x.rank_breakdown?.[k] ?? 0).toFixed(1)}</T>
                      </Row>
                    ))}
                    {Number(x.rank_breakdown.penalty) > 0 ? <Row style={{ justifyContent: 'space-between' }}><T v="small">規約違反による減点</T><T v="small" color={colors.danger}>−{x.rank_breakdown.penalty}</T></Row> : null}
                  </View>
                ) : null}
                <T v="small" style={{ marginTop: space.md }}>ランクは写真・プロフィールの充実、運営の審査（非公開）、確認済みの所属店舗、アプリ内の確定報酬と完了実績で決まります。店舗での売上額や容姿の採点は使用しません。</T>
              </Card>
            </Section>

            <Section title="LEVEL ・ 達成メーター">
              <LevelCard level={x.level} xp={x.xp} floor={x.level_floor_xp} next={x.next_level_xp} />
              <View style={{ marginTop: space.md }}><Badges badges={x.badges} /></View>
            </Section>
          </>
        )}
      </Screen>
    </>
  );
}

