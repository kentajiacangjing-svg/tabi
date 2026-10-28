import { View } from 'react-native';

import { Card, DemoTag, Divider, Header, Notice, RankBadge, Row, Screen, Section, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { yen } from '@/lib/format';
import { space } from '@/theme/tokens';

export default function Pricing() {
  const { settings } = useAuth();
  const plans = settings?.plans ?? [];
  const rules = (settings?.rank_rules ?? []).filter((r) => r.audience === 'man_spend');
  const pol = settings?.settings?.cancellation_policy as { free_until_hours?: number; late_fee_rate?: number } | undefined;
  return (
    <>
      <Header title="料金について" />
      <Screen>
        <Notice icon="info" title="すべて仮設定です">正式な価格は未確定です。表示中の金額はデモ値で、決済は疑似決済（サンドボックス）です。実際の請求は発生しません。</Notice>
        <Section title="WOMEN ・ 女性会員">
          <Card><T v="body">登録・基本利用は無料です。予約完了時の報酬から、所定の手数料（仮設定）を差し引いた額が台帳に記録されます。実際の送金機能は契約・法令確認後に提供します。</T></Card>
        </Section>
        <Section title="MEN ・ 男性会員プラン（月額）" action={<DemoTag />}>
          <Card padded={false}>
            {plans.map((p, i) => (
              <View key={p.code}>
                {i > 0 ? <Divider /> : null}
                <Row style={{ padding: space.lg, justifyContent: 'space-between' }}>
                  <Row gap={space.md}><RankBadge code={p.unlock_rank} size="sm" /><View><T v="h3">{p.name}</T><T v="small">{p.unlock_rank}ランクまで申し込み可能</T></View></Row>
                  <T v="h3">{p.monthly_price ? `${yen(p.monthly_price)}/月` : '無料'}</T>
                </Row>
              </View>
            ))}
          </Card>
          <T v="small" style={{ marginTop: space.sm }}>会員プランは申し込み資格であり、予約の成立を保証するものではありません。デジタル会員機能のため、アプリ内課金の規約に従って提供予定です。</T>
        </Section>
        <Section title="SPEND RANK ・ 利用実績による解放">
          <Card padded={false}>
            {rules.map((r, i) => (
              <View key={r.code}>
                {i > 0 ? <Divider /> : null}
                <Row style={{ padding: space.lg, justifyContent: 'space-between' }}><Row gap={space.md}><RankBadge code={r.code} size="sm" /><T v="body">{r.label}ランク</T></Row><T v="sub">確定利用額 {yen(Number(r.min_value))} 以上</T></Row>
              </View>
            ))}
          </Card>
        </Section>
        <Section title="BOOKING ・ 予約">
          <Card>
            <T v="body">予約金額は女性会員が各枠に設定します。お相手の承認後に与信、完了時に確定します（現在は疑似決済）。</T>
            <T v="sub" style={{ marginTop: space.sm }}>キャンセル：開始{pol?.free_until_hours ?? 24}時間前まで無料、それ以降は予約金額の{Math.round((pol?.late_fee_rate ?? 0) * 100)}%（仮設定・本番前に確定）。</T>
          </Card>
        </Section>
      </Screen>
    </>
  );
}
