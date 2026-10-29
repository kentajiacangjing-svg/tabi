import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badges, LevelCard, TopBar, VerifyBanner } from '@/components/blocks';
import { Icon, type IconName } from '@/components/Icon';
import { Button, Card, Disclosure, ErrorState, LoadingList, Meter, Notice, RankBadge, Row, Screen, Section, T } from '@/components/ui';
import { useRpc } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { rangeLabel, yen } from '@/lib/format';
import type { WomanDashboard } from '@/lib/types';
import { colors, radius, space } from '@/theme/tokens';

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
        <T v="h2" style={{ marginTop: space.xs }}>{me.display_name}さん</T>
        <VerifyBanner me={me} />
        {me.verification.status === 'approved' && !me.woman?.is_published ? (
          <View style={{ marginTop: space.md }}>
            <Notice icon="info" title="プロフィールは非公開です" action={<Button small variant="outline" title="プロフィールを整える" onPress={() => router.push('/profile')} />}>
              写真を1枚以上登録して公開すると、男性会員の検索に表示されます。
            </Notice>
          </View>
        ) : null}

        {d.loading ? <LoadingList /> : d.error || !x ? <ErrorState message={d.error ?? ''} onRetry={d.reload} /> : (
          <>
            <Now x={x} />
            <Earnings x={x} />
            <RankCard x={x} />
            <Section title="LEVEL ・ 達成メーター">
              <LevelCard level={x.level} xp={x.xp} floor={x.level_floor_xp} next={x.next_level_xp} />
              <View style={{ marginTop: space.md }}>
                <Disclosure title={`バッジ（${x.badges.filter((b) => b.earned).length}/${x.badges.length} 獲得）`} testID="badges-toggle">
                  <Badges badges={x.badges} />
                </Disclosure>
              </View>
            </Section>
          </>
        )}
      </Screen>
    </>
  );
}

/** 今どうなっているか：対応が必要なこと → 次の予定 → 受付状態 の順に並べる */
function Now({ x }: { x: WomanDashboard }) {
  const next = x.upcoming[0];
  const tasks: { icon: IconName; title: string; sub: string; href: string; testID: string }[] = [];
  if (x.pending_bookings > 0) tasks.push({ icon: 'calendar', title: `承認待ちの予約 ${x.pending_bookings}件`, sub: '承認するまで予約は確定しません', href: '/w/requests', testID: 'task-bookings' });
  if (x.pending_applications > 0) tasks.push({ icon: 'user', title: `プロフィール申請 ${x.pending_applications}件`, sub: '承認した方だけが予約申請できます', href: '/w/requests', testID: 'task-applications' });
  return (
    <Section title="NOW ・ いまの状況">
      <Card padded={false}>
        {tasks.length ? tasks.map((t) => (
          <Pressable key={t.testID} testID={t.testID} accessibilityRole="button" accessibilityLabel={t.title} onPress={() => router.push(t.href as never)}
            style={({ pressed }) => [styles.task, pressed && { backgroundColor: colors.goldWash }]}>
            <View style={styles.taskIcon}><Icon name={t.icon} size={17} color={colors.goldDeep} /></View>
            <View style={{ flex: 1 }}>
              <T v="h3" style={{ fontSize: 14.5 }}>{t.title}</T>
              <T v="small">{t.sub}</T>
            </View>
            <T v="small" color={colors.goldDeep} style={{ fontWeight: '600' }}>確認する</T>
          </Pressable>
        )) : (
          <Row gap={space.md} style={styles.task}>
            <View style={styles.taskIcon}><Icon name="check" size={17} color={colors.success} /></View>
            <T v="sub" style={{ flex: 1 }}>対応が必要な申込はありません</T>
          </Row>
        )}
        <Pressable onPress={() => router.push(next ? `/booking/${next.id}` : '/w/schedule')} accessibilityRole="button" accessibilityLabel="次の予定"
          style={({ pressed }) => [styles.task, styles.sep, pressed && { backgroundColor: colors.goldWash }]}>
          <View style={styles.taskIcon}><Icon name="clock" size={17} color={colors.goldDeep} /></View>
          <View style={{ flex: 1 }}>
            <T v="small">次の予定{x.upcoming.length > 1 ? `（ほか${x.upcoming.length - 1}件）` : ''}</T>
            <T v="h3" style={{ fontSize: 14.5 }}>{next ? `${rangeLabel(next.start_at, next.end_at)}` : '確定済みの予定はありません'}</T>
            {next ? <T v="small">{next.man_name}さん ・ {next.plan_type} ・ {next.area}</T> : null}
          </View>
          <Icon name="chevron-right" size={16} color={colors.faint} />
        </Pressable>
        <Pressable onPress={() => router.push('/accept-settings')} accessibilityRole="button" accessibilityLabel="受付設定" testID="w-accept-settings"
          style={({ pressed }) => [styles.task, styles.sep, pressed && { backgroundColor: colors.goldWash }]}>
          <View style={styles.taskIcon}><Icon name="settings" size={17} color={colors.goldDeep} /></View>
          <View style={{ flex: 1 }}>
            <T v="small">受付設定</T>
            <T v="h3" style={{ fontSize: 14.5 }}>
              {x.accept_requests ? '新規受付中' : '新規受付を停止中'} ・ {x.accept_mode === 'open' ? '空き枠へ直接申込' : 'まずプロフィール申請'}
            </T>
            <T v="small">受け方にかかわらず、予約はあなたが1件ずつ承認して成立します。</T>
          </View>
          <Icon name="chevron-right" size={16} color={colors.faint} />
        </Pressable>
      </Card>
      <View style={{ marginTop: space.sm, alignSelf: 'flex-start' }}>
        <Button small variant="ghost" icon="plus" title="空き枠を追加" onPress={() => router.push('/schedule-new')} />
      </View>
    </Section>
  );
}

/** 収益：確定 / 予定 / 保留 を同じ並びで。確定以外はまだ受け取れる額ではないことを明記する */
function Earnings({ x }: { x: WomanDashboard }) {
  const cols = [
    { k: '確定', v: x.month_net, note: `今月 完了${x.month_completed}件`, strong: true },
    { k: '予定', v: x.expected_net, note: `予約 ${x.expected_count}件` },
    { k: '保留', v: x.held_net, note: x.held_count ? `申立て ${x.held_count}件` : 'なし' },
  ];
  return (
    <Section title="EARNINGS ・ 報酬" action={x.is_sandbox ? <T v="small" color={colors.goldDeep} style={{ fontWeight: '600' }}>デモ（疑似決済）</T> : undefined}>
      <Card onPress={() => router.push('/earnings')} accessibilityLabel="報酬の詳細">
        <Row style={{ alignItems: 'stretch' }}>
          {cols.map((c, i) => (
            <View key={c.k} style={[{ flex: 1, gap: 2 }, i > 0 && styles.colSep]} testID={`earn-${i}`}>
              <T v="small" color={c.strong ? colors.goldDeep : colors.sub} style={{ fontWeight: '600' }}>{c.k}</T>
              <T v="num" style={{ fontSize: c.strong ? 24 : 19, color: c.strong ? colors.text : colors.sub }}>{yen(c.v)}</T>
              <T v="small" style={{ fontSize: 11 }}>{c.note}</T>
            </View>
          ))}
        </Row>
        <T v="small" style={{ marginTop: space.md }}>確定＝完了した予約の報酬（手数料控除後）。予定・保留は見込みで、完了や運営の判断によって変わります。</T>
      </Card>
    </Section>
  );
}

function RankCard({ x }: { x: WomanDashboard }) {
  const score = Number(x.rank_score);
  const breakdown = (
    <Disclosure title="ランクの内訳と決まり方" testID="rank-breakdown">
      {x.rank_breakdown ? (
        <View style={{ gap: 6 }}>
          {PARTS.map(([k, l]) => (
            <Row key={k} style={{ justifyContent: 'space-between' }}>
              <T v="small">{l}</T>
              <T v="small" style={{ color: colors.text }}>{Number(x.rank_breakdown?.[k] ?? 0).toFixed(1)}</T>
            </Row>
          ))}
          {Number(x.rank_breakdown.penalty) > 0 ? <Row style={{ justifyContent: 'space-between' }}><T v="small">規約違反による減点</T><T v="small" color={colors.danger}>−{x.rank_breakdown.penalty}</T></Row> : null}
        </View>
      ) : null}
      <T v="small" style={{ marginTop: space.sm }}>写真・プロフィールの充実、運営の審査（非公開）、確認済みの所属店舗、アプリ内の確定報酬と完了実績で決まります。店舗での売上額や容姿の採点は使用しません。</T>
    </Disclosure>
  );
  if (x.is_top_rank) {
    return (
      <Section title="RANK ・ ランク">
        <View style={styles.top} testID="rank-top">
          <Row gap={space.md}>
            <RankBadge code={x.rank_code} size="lg" />
            <View style={{ flex: 1 }}>
              <T v="caption">TOP RANK</T>
              <T v="h2">最上位の {x.rank_code} ランクです</T>
              <T v="small">スコア {score.toFixed(1)} ・ 定期的に再計算されます</T>
            </View>
          </Row>
          <View style={{ marginTop: space.md }}>
            <Meter value={1} max={1} complete height={5} left="最上位ランクを維持中" right={`下限 ${x.rank_floor} pt`} />
          </View>
          <View style={{ marginTop: space.md }}>{breakdown}</View>
        </View>
      </Section>
    );
  }
  const floor = Number(x.rank_floor ?? 0);
  return (
    <Section title="RANK ・ ランク">
      <Card>
        <Row gap={space.md}>
          <RankBadge code={x.rank_code} size="lg" />
          <View style={{ flex: 1 }}>
            <T v="h2">{x.rank_code} ランク</T>
            <T v="small">スコア {score.toFixed(1)} / 100</T>
          </View>
        </Row>
        <View style={{ marginTop: space.md }}>
          <Meter
            value={score - floor}
            max={(x.next_rank?.min_value ?? 100) - floor}
            height={5}
            left={x.next_rank ? `${x.next_rank.code} ランクまで あと ${(x.next_rank.min_value - score).toFixed(1)} pt` : ''}
            right={x.next_rank ? `${x.next_rank.min_value} pt` : ''}
          />
        </View>
        <View style={{ marginTop: space.md }}>{breakdown}</View>
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  task: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 56 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  taskIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.goldWash, alignItems: 'center', justifyContent: 'center' },
  colSep: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border, paddingLeft: space.md, marginLeft: space.md },
  top: { padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.goldWash },
});
