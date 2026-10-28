import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, ErrorState, Field, LoadingList, Notice, Row, Segmented, T, Toggle, useToast } from '@/components/ui';
import { call, toMessage, useRpc } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AdminPage } from '@/screens/AdminKit';
import { space } from '@/theme/tokens';

type Setting = { key: string; value: unknown; description: string; is_public: boolean };
type PlanRow = { code: string; name: string; monthly_price: number; unlock_rank: string; perks: string[]; sort: number; is_active: boolean; is_demo_price: boolean };
type RuleRow = { audience: 'woman' | 'man_spend'; code: string; label: string; min_value: number; sort: number };
type Data = { settings: Setting[]; plans: PlanRow[]; rank_rules: RuleRow[] };

export default function Config() {
  const res = useRpc<Data>('admin_list_settings');
  const [tab, setTab] = useState<'plans' | 'ranks' | 'settings'>('plans');
  return (
    <AdminPage title="プラン・ランク・設定" subtitle="すべて仮設定。変更は監査ログに記録されます" refreshing={res.refreshing} onRefresh={res.refresh}>
      <Segmented value={tab} onChange={setTab} options={[{ value: 'plans', label: '課金プラン' }, { value: 'ranks', label: 'ランク境界' }, { value: 'settings', label: 'サービス設定' }]} />
      <View style={{ marginTop: space.lg, gap: space.md }}>
        {res.loading ? <LoadingList /> : res.error || !res.data ? <ErrorState message={res.error ?? ''} onRetry={res.reload} /> : tab === 'plans' ? (
          res.data.plans.map((p) => <PlanEditor key={p.code} p={p} onSaved={(d) => res.setData(d)} />)
        ) : tab === 'ranks' ? (
          <RankEditor key={JSON.stringify(res.data.rank_rules)} rules={res.data.rank_rules} onSaved={(d) => res.setData(d)} />
        ) : (
          res.data.settings.map((s) => <SettingEditor key={s.key} s={s} onSaved={(d) => res.setData(d)} />)
        )}
      </View>
    </AdminPage>
  );
}

function PlanEditor({ p, onSaved }: { p: PlanRow; onSaved: (d: Data) => void }) {
  const toast = useToast();
  const { refreshMe } = useAuth();
  const [name, setName] = useState(p.name);
  const [price, setPrice] = useState(String(p.monthly_price));
  const [rank, setRank] = useState(p.unlock_rank);
  const [perks, setPerks] = useState(p.perks.join('\n'));
  const [active, setActive] = useState(p.is_active);
  const save = async () => {
    try {
      onSaved(await call<Data>('admin_upsert_plan', { p_code: p.code, p_name: name, p_price: Number(price), p_unlock_rank: rank, p_perks: perks.split('\n').map((x) => x.trim()).filter(Boolean), p_is_active: active, p_sort: p.sort }));
      refreshMe();
      toast(`${p.code} を保存しました`);
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  return (
    <Card>
      <T v="caption">{p.code}{p.is_demo_price ? ' ・ DEMO PRICE' : ''}</T>
      <Row gap={space.md} wrap style={{ marginTop: space.sm, alignItems: 'flex-start' }}>
        <View style={{ flexGrow: 1, flexBasis: 180 }}><Field label="表示名" value={name} onChangeText={setName} /></View>
        <View style={{ flexGrow: 1, flexBasis: 140 }}><Field label="月額（円）" value={price} onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" testID={`plan-price-${p.code}`} /></View>
      </Row>
      <T v="small" style={{ marginBottom: 6, fontWeight: '600' }}>解放ランク</T>
      <Row gap={space.sm} style={{ marginBottom: space.lg }}>{['C', 'B', 'A', 'S'].map((r) => <Chip key={r} label={r} selected={rank === r} onPress={() => setRank(r)} />)}</Row>
      <Field label="特典（1行に1つ）" value={perks} onChangeText={setPerks} multiline />
      <Toggle value={active} onChange={setActive} label="販売中" />
      <Button small title="保存" onPress={save} testID={`plan-save-${p.code}`} />
    </Card>
  );
}

function RankEditor({ rules, onSaved }: { rules: RuleRow[]; onSaved: (d: Data) => void }) {
  const toast = useToast();
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(rules.map((r) => [`${r.audience}:${r.code}`, String(r.min_value)])));
  const save = async (r: RuleRow) => {
    try {
      onSaved(await call<Data>('admin_upsert_rank_rule', { p_audience: r.audience, p_code: r.code, p_label: r.label, p_min: Number(vals[`${r.audience}:${r.code}`]), p_sort: r.sort }));
      toast('保存し、全ユーザーのランクを再計算しました');
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  const group = (aud: 'woman' | 'man_spend', title: string, unit: string, note: string) => (
    <Card>
      <T v="h3">{title}</T>
      <T v="small" style={{ marginBottom: space.md }}>{note}</T>
      {rules.filter((r) => r.audience === aud).map((r) => (
        <Row key={r.code} gap={space.md} style={{ alignItems: 'center' }}>
          <T v="h3" style={{ width: 28 }}>{r.code}</T>
          <View style={{ flex: 1 }}><Field label={`下限（${unit}）`} value={vals[`${aud}:${r.code}`] ?? ''} onChangeText={(t) => setVals({ ...vals, [`${aud}:${r.code}`]: t.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" /></View>
          <Button small variant="outline" title="保存" onPress={() => save(r)} />
        </Row>
      ))}
    </Card>
  );
  return (
    <>
      <Notice icon="info">ランク境界を変更すると、対象の全ユーザーのランクがサーバーで再計算され、計算根拠が履歴に残ります。</Notice>
      {group('woman', '女性ランク（スコア 0〜100）', 'スコア', 'プロフィール充実・運営審査（非公開）・確認済み店舗・アプリ内確定報酬・完了実績の合計。店舗売上・容姿の採点は使用しません。')}
      {group('man_spend', '男性：累計確定利用額ランク', '円', '完了（支払い確定）した予約の合計から返金を差し引いた額。')}
    </>
  );
}

function SettingEditor({ s, onSaved }: { s: Setting; onSaved: (d: Data) => void }) {
  const toast = useToast();
  const kind = typeof s.value === 'boolean' ? 'bool' : typeof s.value === 'number' ? 'num' : typeof s.value === 'string' ? 'str' : 'json';
  const [text, setText] = useState(kind === 'json' ? JSON.stringify(s.value, null, 1) : String(s.value));
  const [bool, setBool] = useState(Boolean(s.value));
  const save = async (override?: unknown) => {
    let value: unknown;
    try {
      value = override !== undefined ? override : kind === 'num' ? Number(text) : kind === 'str' ? text : JSON.parse(text);
    } catch {
      return toast('JSON の形式が正しくありません', 'error');
    }
    try {
      onSaved(await call<Data>('admin_update_setting', { p_key: s.key, p_value: value }));
      toast(`${s.key} を保存しました`);
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }} wrap>
        <T v="h3" style={{ fontSize: 14 }}>{s.key}</T>
        <T v="small">{s.is_public ? '公開設定' : '非公開設定'}</T>
      </Row>
      <T v="small" style={{ marginBottom: space.md }}>{s.description}</T>
      {kind === 'bool' ? (
        <Toggle value={bool} onChange={(v) => { setBool(v); save(v); }} label={bool ? '有効' : '無効'} />
      ) : (
        <>
          <Field label="値" value={text} onChangeText={setText} multiline={kind === 'json'} keyboardType={kind === 'num' ? 'decimal-pad' : 'default'} autoCapitalize="none" />
          <Button small variant="outline" title="保存" onPress={() => save()} />
        </>
      )}
    </Card>
  );
}
