import { router } from 'expo-router';
import { useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Button, Card, IconButton, Meter, Notice, Photo, Pill, RankBadge, Row, T } from '@/components/ui';
import { useAuth, useServiceName } from '@/lib/auth';
import { dateLabel, rangeLabel, timeLabel, yen } from '@/lib/format';
import type { Badge, Me, WomanCard as WomanCardT } from '@/lib/types';
import { colors, fonts, maxWidth, radius, space } from '@/theme/tokens';

/** タブ画面の上部バー（ブランド + 通知） */
export function TopBar({ title }: { title?: string }) {
  const insets = useSafeAreaInsets();
  const { me } = useAuth();
  const name = useServiceName();
  return (
    <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
      <View style={[styles.topRow, { maxWidth }]}>
        <View style={{ flex: 1 }}>
          <T v="brand" style={{ fontSize: 17, letterSpacing: 4 }}>{name}</T>
          {title ? <T v="title" style={{ marginTop: 2 }}>{title}</T> : null}
        </View>
        <IconButton name="bell" label="通知" onPress={() => router.push('/notifications')} badge={me?.unread_notifications} />
      </View>
    </View>
  );
}

export function VerifyBanner({ me }: { me: Me }) {
  const s = me.verification.status;
  if (s === 'approved') return null;
  const text = {
    unsubmitted: '本人確認（20歳以上）を完了すると、申し込み・予約・プロフィール公開ができるようになります。',
    pending: '本人確認を審査中です。完了までしばらくお待ちください。',
    rejected: `本人確認ができませんでした。${me.verification.rejection_reason ?? ''}`,
  }[s];
  return (
    <View style={{ marginTop: space.lg }}>
      <Notice
        tone={s === 'rejected' ? 'danger' : 'gold'}
        icon="shield"
        title={s === 'pending' ? '本人確認：審査中' : '本人確認が必要です'}
        action={s !== 'pending' ? <Button small variant="outline" title="本人確認へ進む" onPress={() => router.push('/verification')} testID="verify-cta" /> : null}>
        {text}
      </Notice>
    </View>
  );
}

/** 女性カード：写真を大きく、文字は写真の外に置いて読みやすくする */
export function WomanCard({ w, width }: { w: WomanCardT; width?: number }) {
  return (
    <Pressable
      testID={`woman-${w.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${w.display_name}、${w.rank_code}ランク、${w.area}${w.locked ? '、ロック中' : ''}`}
      onPress={() => router.push(`/woman/${w.id}`)}
      style={({ pressed }) => [styles.wCard, width ? { width } : { flex: 1 }, pressed && { opacity: 0.92 }]}>
      <View>
        <Photo path={w.photos[0]} style={{ width: '100%', aspectRatio: 4 / 5 }} rounded={radius.lg} />
        {w.locked ? (
          <View style={styles.lockChip}>
            <Icon name="lock" size={13} color={colors.goldDeep} strokeWidth={1.8} />
            <T v="small" color={colors.goldDeep} style={{ fontWeight: '600' }}>{w.rank_code}ランク</T>
          </View>
        ) : null}
      </View>
      <View style={{ paddingTop: space.md, paddingHorizontal: 2, gap: 4 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="h3" numberOfLines={1} style={{ flex: 1 }}>{w.display_name}</T>
          <RankBadge code={w.rank_code} size="sm" locked={w.locked} />
        </Row>
        <T v="small" numberOfLines={1}>{[w.area, ...(w.areas ?? []).filter((a) => a !== w.area)].slice(0, 2).join('・')}{w.venue ? ` ／ ${w.venue.name}` : ''}</T>
        {w.headline ? <T v="sub" numberOfLines={1}>{w.headline}</T> : null}
        <Row gap={6} wrap style={{ marginTop: 2 }}>
          <Pill label={w.accept_mode === 'open' ? '幅広く受付中' : '承認制'} tone={w.accept_mode === 'open' ? 'gold' : 'neutral'} />
          {w.next_slot ? <Pill label={`空き ${rangeLabel(w.next_slot.start_at, w.next_slot.end_at).split(' ')[0]}`} tone="neutral" icon="calendar" /> : null}
        </Row>
      </View>
    </Pressable>
  );
}

export function useColumns(min = 168) {
  const { width } = useWindowDimensions();
  const content = Math.min(width, 1120) - space.lg * 2;
  const cols = Math.max(2, Math.min(4, Math.floor((content + space.md) / (min + space.md))));
  const itemW = Math.floor((content - space.md * (cols - 1)) / cols);
  return { cols, itemW: width < 340 ? Math.floor((content - space.md) / 2) : itemW };
}

export function Grid<T>({ items, render, min }: { items: T[]; render: (item: T, width: number) => React.ReactNode; min?: number }) {
  const { itemW } = useColumns(min);
  return <View style={styles.grid}>{items.map((it) => render(it, itemW))}</View>;
}

export function Carousel({ paths, height }: { paths: string[]; height?: number }) {
  const { width } = useWindowDimensions();
  const w = Math.min(width, maxWidth);
  const h = height ?? Math.min(w * 1.2, 640);
  const [idx, setIdx] = useState(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIdx(Math.round(e.nativeEvent.contentOffset.x / w));
  if (!paths.length) return <Photo path={null} style={{ width: w, height: h }} rounded={0} />;
  return (
    <View style={{ width: w, height: h, alignSelf: 'center' }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={32}>
        {paths.map((p) => <Photo key={p} path={p} style={{ width: w, height: h }} rounded={0} />)}
      </ScrollView>
      {paths.length > 1 ? (
        <View style={styles.dots}>
          {paths.map((p, i) => <View key={p} style={[styles.dotI, i === idx && { backgroundColor: '#fff', width: 18 }]} />)}
        </View>
      ) : null}
    </View>
  );
}

export function Badges({ badges }: { badges: Badge[] }) {
  return (
    <Row wrap gap={6}>
      {badges.map((b) => <Pill key={b.code} label={b.label} tone={b.earned ? 'gold' : 'neutral'} icon={b.earned ? 'star' : undefined} />)}
    </Row>
  );
}

export function LevelCard({ level, xp, floor, next }: { level: number; xp: number; floor: number; next: number }) {
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <Row gap={6} style={{ alignItems: 'flex-end' }}>
            <T v="small" style={{ marginBottom: 6 }}>Lv.</T>
            <T v="num">{level}</T>
          </Row>
        </View>
        <T v="small">次のレベルまで {Math.max(next - xp, 0)} pt</T>
      </Row>
      <View style={{ marginTop: space.md }}>
        <Meter value={xp - floor} max={next - floor} left={`${xp} pt`} right={`${next} pt`} />
      </View>
      <T v="small" style={{ marginTop: space.sm }}>本人確認・予約の完了・トラブルのない利用などで上がります。</T>
    </Card>
  );
}

export function SlotRow({ start, end, plan, price, area, right }: { start: string; end: string; plan: string; price?: number; area?: string; right?: React.ReactNode }) {
  return (
    <View style={styles.slot}>
      <View style={styles.slotDate}><Icon name="calendar" size={18} color={colors.goldDeep} /></View>
      <View style={{ flex: 1 }}>
        <T v="h3">{dateLabel(start)}<T v="body" style={{ color: colors.text }}>  {timeLabel(start)}–{timeLabel(end)}</T></T>
        <T v="small">{[plan, area].filter(Boolean).join(' ・ ')}{price !== undefined ? ` ・ ${yen(price)}` : ''}</T>
      </View>
      {right}
    </View>
  );
}

export const serifNum = { fontFamily: fonts.serif };

const styles = StyleSheet.create({
  top: { backgroundColor: colors.bg, paddingHorizontal: space.lg, paddingBottom: space.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', width: '100%', alignSelf: 'center' },
  wCard: { marginBottom: space.lg },
  lockChip: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: '#E9DDC4' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md },
  dots: { position: 'absolute', bottom: 14, alignSelf: 'center', flexDirection: 'row', gap: 6, backgroundColor: 'rgba(23,23,23,0.25)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  dotI: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
  slot: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  slotDate: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.goldWash, alignItems: 'center', justifyContent: 'center' },
});
