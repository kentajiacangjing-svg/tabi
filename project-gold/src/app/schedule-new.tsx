import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Card, Chip, Field, Header, Row, Screen, Section, T, useToast } from '@/components/ui';
import { call, toMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { jstDayLabel, jstToIso, rangeLabel, yen } from '@/lib/format';
import { space } from '@/theme/tokens';

const TIMES = Array.from({ length: 26 }, (_, i) => 11 * 60 + i * 30); // 11:00〜23:30
const DURATIONS = [60, 90, 120, 180];

export default function ScheduleNew() {
  const { me } = useAuth();
  const toast = useToast();
  const areas = me?.woman?.areas?.length ? me.woman.areas : [me?.area || '銀座'];
  const plans = me?.woman?.plan_types?.length ? me.woman.plan_types : ['食事', 'カフェ'];
  const [day, setDay] = useState(1);
  const [start, setStart] = useState(19 * 60);
  const [dur, setDur] = useState(120);
  const [area, setArea] = useState(areas[0]);
  const [plan, setPlan] = useState(plans[0]);
  const [price, setPrice] = useState('20000');
  const [note, setNote] = useState('');

  const startIso = useMemo(() => jstToIso(day, start), [day, start]);
  const endIso = useMemo(() => jstToIso(day, start + dur), [day, start, dur]);
  const [openedAt] = useState(() => Date.now());
  const past = new Date(startIso).getTime() <= openedAt;
  const priceNum = Number(price || 0);

  const submit = async () => {
    try {
      await call('create_slot', { p_start: startIso, p_end: endIso, p_area: area, p_plan_type: plan, p_price: priceNum, p_note: note });
      toast('空き枠を追加しました');
      router.back();
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };

  return (
    <>
      <Header title="空き枠を追加" />
      <Screen footer={<Button title={past ? '過去の時間は選べません' : 'この内容で追加する'} onPress={submit} disabled={past || priceNum <= 0} testID="slot-submit" />}>
        <Section title="DATE ・ 日付" style={{ marginTop: space.sm }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {Array.from({ length: 21 }, (_, i) => i).map((d) => {
              const l = jstDayLabel(d);
              return <Chip key={d} label={d === 0 ? `今日 ${l.md}` : `${l.md}（${l.wd}）`} selected={day === d} onPress={() => setDay(d)} />;
            })}
          </ScrollView>
        </Section>
        <Section title="START ・ 開始時刻">
          <Row wrap gap={space.sm}>
            {TIMES.map((t) => <Chip key={t} label={`${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`} selected={start === t} onPress={() => setStart(t)} />)}
          </Row>
        </Section>
        <Section title="DURATION ・ 時間">
          <Row wrap gap={space.sm}>{DURATIONS.map((d) => <Chip key={d} label={d % 60 ? `${Math.floor(d / 60)}時間${d % 60}分` : `${d / 60}時間`} selected={dur === d} onPress={() => setDur(d)} />)}</Row>
        </Section>
        <Section title="PLAN & AREA ・ 内容とエリア">
          <Row wrap gap={space.sm}>{plans.map((p) => <Chip key={p} label={p} selected={plan === p} onPress={() => setPlan(p)} />)}</Row>
          <Row wrap gap={space.sm} style={{ marginTop: space.md }}>{areas.map((a) => <Chip key={a} label={a} icon="pin" selected={area === a} onPress={() => setArea(a)} />)}</Row>
        </Section>
        <Section title="PRICE ・ 希望料金（テスト）">
          <Field label="金額（円）" value={price} onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, '').slice(0, 7))} keyboardType="number-pad" testID="slot-price" hint="実際の販売は契約・法令確認後。現在は疑似決済でのテストのみです" />
          <Field label="メモ（任意・公開）" value={note} onChangeText={setNote} maxLength={300} placeholder="例：銀座エリアのレストランでお食事" />
        </Section>
        <Card>
          <T v="caption">PREVIEW</T>
          <T v="h3" style={{ marginTop: 4 }}>{rangeLabel(startIso, endIso)}</T>
          <T v="sub">{plan} ・ {area} ・ {yen(priceNum)}</T>
        </Card>
        <View style={{ height: space.lg }} />
      </Screen>
    </>
  );
}
