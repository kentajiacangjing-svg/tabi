import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, TextInput, View, StyleSheet } from 'react-native';

import { Grid, TopBar, WomanCard } from '@/components/blocks';
import { Icon } from '@/components/Icon';
import { Chip, Empty, ErrorState, LoadingList, Row, Screen, Segmented, T, Toggle } from '@/components/ui';
import { useRpc } from '@/lib/api';
import { jstDayLabel } from '@/lib/format';
import type { WomanCard as W } from '@/lib/types';
import { colors, radius, space } from '@/theme/tokens';

const AREAS = ['すべて', '銀座', '六本木', '新宿', '渋谷', '恵比寿', '表参道', '日本橋', '麻布十番'];
const RANKS = ['ALL', 'C', 'B', 'A', 'S'] as const;

export default function Search() {
  const params = useLocalSearchParams<{ area?: string; rank?: string }>();
  // ホームのエリアチップから来た場合はそのエリアを初期値にする（ユーザーが選び直したらそちらを優先）
  const [picked, setPicked] = useState<{ from?: string; value: string } | null>(null);
  const area = picked && picked.from === params.area ? picked.value : (params.area ?? 'すべて');
  const setArea = (value: string) => setPicked({ from: params.area, value });
  // ホームの「ランクから探す」から来た場合はそのランクを初期値にする
  const [pickedRank, setPickedRank] = useState<{ from?: string; value: (typeof RANKS)[number] } | null>(null);
  const initRank = (RANKS as readonly string[]).includes(params.rank ?? '') ? (params.rank as (typeof RANKS)[number]) : 'ALL';
  const rank = pickedRank && pickedRank.from === params.rank ? pickedRank.value : initRank;
  const setRank = (value: (typeof RANKS)[number]) => setPickedRank({ from: params.rank, value });
  const [day, setDay] = useState<number | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const args = useMemo(() => ({
    p_area: area === 'すべて' ? null : area,
    p_rank: rank === 'ALL' ? null : rank,
    p_date: day === null ? null : jstDayLabel(day).iso,
    p_open_only: openOnly,
    p_query: query || null,
    p_limit: 60,
  }), [area, rank, day, openOnly, query]);
  const res = useRpc<W[]>('search_women', args);
  const days = Array.from({ length: 14 }, (_, i) => i);

  return (
    <>
      <TopBar title="さがす" />
      <Screen refreshing={res.refreshing} onRefresh={res.refresh} wide>
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={colors.faint} />
          <TextInput value={q} onChangeText={setQ} placeholder="名前・ひとことで検索" placeholderTextColor={colors.faint} style={styles.searchInput} accessibilityLabel="キーワード検索" testID="search-input" />
        </View>
        <T v="caption" style={{ marginTop: space.lg, marginBottom: space.sm }}>AREA</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {AREAS.map((a) => <Chip key={a} label={a} selected={area === a} onPress={() => setArea(a)} />)}
        </ScrollView>
        <T v="caption" style={{ marginTop: space.lg, marginBottom: space.sm }}>RANK</T>
        <Segmented value={rank} onChange={setRank} options={RANKS.map((r) => ({ value: r, label: r === 'ALL' ? 'すべて' : r }))} />
        <T v="caption" style={{ marginTop: space.lg, marginBottom: space.sm }}>DATE</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          <Chip label="指定なし" selected={day === null} onPress={() => setDay(null)} />
          {days.map((d) => {
            const l = jstDayLabel(d);
            return <Chip key={d} label={d === 0 ? `今日 ${l.md}` : `${l.md}（${l.wd}）`} selected={day === d} onPress={() => setDay(d)} />;
          })}
        </ScrollView>
        <Toggle value={openOnly} onChange={setOpenOnly} label="幅広く受け付けている方のみ" description="「自分で選ぶ」モードの方は、プロフィール申請の承認後に予約申請できます" />

        <Row style={{ justifyContent: 'space-between', marginTop: space.md, marginBottom: space.md }}>
          <T v="sub">{res.data ? `${res.data.length}名` : ' '}</T>
          <T v="small">空き枠の近い順</T>
        </Row>
        {res.loading ? <LoadingList count={2} h={260} /> : res.error ? <ErrorState message={res.error} onRetry={res.reload} /> : !res.data?.length ? (
          <Empty icon="search" title="条件に合う方が見つかりませんでした" text="エリアや日付の条件をゆるめてみてください。" />
        ) : (
          <Grid items={res.data} render={(w, width) => <WomanCard key={w.id} w={w} width={width} />} />
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: space.lg, minHeight: 48, marginTop: space.sm },
  searchInput: { flex: 1, fontSize: 15.5, color: colors.text, minHeight: 46 },
});
