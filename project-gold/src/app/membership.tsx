import { View, useWindowDimensions } from 'react-native';

import { Badges, LevelCard } from '@/components/blocks';
import { Icon } from '@/components/Icon';
import {
  Button, Card, DemoTag, Divider, ErrorState, Gap, Header, LoadingList, Meter, Notice, Pill, RankBadge, Row, Screen, Section, T,
  useConfirm, useToast,
} from '@/components/ui';
import { call, toMessage, useRpc } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateLabel, PAYMENT_LABEL, yen } from '@/lib/format';
import type { MembershipOverview, Plan } from '@/lib/types';
import { colors, space } from '@/theme/tokens';

export default function Membership() {
  const res = useRpc<MembershipOverview>('membership_overview');
  const { refreshMe } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { width } = useWindowDimensions();
  const ov = res.data;

  const subscribe = async (p: Plan) => {
    const r = await confirm({
      title: `${p.name} プランに変更しますか？`,
      message: `月額 ${yen(p.monthly_price)}（デモ価格）。サンドボックスの疑似決済のため、実際の請求は発生しません。${p.unlock_rank}ランクまでの女性へ申し込めるようになります（予約の成立を保証するものではありません）。`,
      confirm: 'デモ決済で変更する',
    });
    if (!r.ok) return;
    try {
      res.setData(await call<MembershipOverview>('sandbox_subscribe', { p_plan: p.code }));
      await refreshMe();
      toast(`${p.name} プランに変更しました（デモ）`);
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  const cancel = async () => {
    const r = await confirm({ title: '自動更新を停止しますか？', message: '現在の期間の終了日まではプランの特典をご利用いただけます。', confirm: '自動更新を停止', danger: true });
    if (!r.ok) return;
    try {
      res.setData(await call<MembershipOverview>('cancel_subscription'));
      toast('自動更新を停止しました');
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  const resume = async () => {
    res.setData(await call<MembershipOverview>('resume_subscription'));
    toast('自動更新を再開しました');
  };

  const cols = width >= 900 ? 4 : width >= 600 ? 2 : 1;

  return (
    <>
      <Header title="会員プラン・ランク" />
      <Screen refreshing={res.refreshing} onRefresh={res.refresh} wide={cols > 2}>
        {res.loading ? <LoadingList /> : res.error || !ov ? <ErrorState message={res.error ?? ''} onRetry={res.reload} /> : (
          <>
            {ov.payment_mode === 'sandbox' ? (
              <Notice icon="info" title="サンドボックス（疑似決済）モード">
                現在は開発・審査前の状態です。プラン変更や予約の支払いはすべて疑似決済で、実際の請求・送金は行われません。表示価格は仮設定です。
              </Notice>
            ) : null}

            <Card style={{ marginTop: space.lg }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <T v="caption">YOUR ACCESS</T>
                  <T v="h2" style={{ marginTop: 4 }}>{ov.access.unlocked_rank}ランクまで申し込みできます</T>
                  <T v="small" style={{ marginTop: 2 }}>{ov.access.verified ? '本人確認済み' : '本人確認が完了すると申し込みできます'}</T>
                </View>
                <RankBadge code={ov.access.unlocked_rank} size="lg" />
              </Row>
              <Divider style={{ marginVertical: space.lg }} />
              <T v="sub" style={{ marginBottom: space.md }}>申し込み可能な範囲は、次の2つのうち広い方で決まります。</T>
              <Row gap={space.md} style={{ alignItems: 'stretch' }} wrap>
                <Path title="利用実績" rank={ov.access.spend_rank} active={ov.access.source === 'spend'} text={`確定利用額 ${yen(ov.spend_total)}`} />
                <Path title="会員プラン" rank={ov.access.plan_rank} active={ov.access.source === 'plan'} text={`${ov.access.plan_code} プラン`} />
              </Row>
              <View style={{ marginTop: space.lg }}>
                <Meter
                  value={ov.spend_total}
                  max={ov.next_spend_rank?.min_value ?? Math.max(ov.spend_total, 1)}
                  label={ov.next_spend_rank ? `利用実績で ${ov.next_spend_rank.code} ランクまで あと ${yen(ov.next_spend_rank.min_value - ov.spend_total)}` : '利用実績ランクは最上位です'}
                  left={yen(ov.spend_total)}
                  right={ov.next_spend_rank ? yen(ov.next_spend_rank.min_value) : ''}
                />
              </View>
              <T v="small" style={{ marginTop: space.sm }}>利用額は予約の完了（支払い確定）分のみ計上され、キャンセル・返金は差し引かれます。利用額がお相手に公開されることはありません。</T>
            </Card>

            <Section title="PLANS ・ 会員プラン" action={<DemoTag label="価格は仮設定" />}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
                {ov.plans.map((p) => {
                  const current = ov.access.plan_code === p.code;
                  return (
                    <Card key={p.code} style={{ width: cols === 1 ? '100%' : undefined, flexBasis: cols === 1 ? undefined : `${100 / cols - 3}%`, flexGrow: 1, borderColor: current ? colors.gold : colors.border }}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <T v="brand" style={{ fontSize: 20, letterSpacing: 3 }}>{p.name}</T>
                        {current ? <Pill label="現在のプラン" tone="dark" /> : null}
                      </Row>
                      <Row gap={4} style={{ alignItems: 'flex-end', marginTop: space.sm }}>
                        {p.monthly_price ? <T v="num" style={{ fontSize: 28 }}>{yen(p.monthly_price)}</T> : <T v="title" style={{ marginTop: 4 }}>無料</T>}
                        {p.monthly_price ? <T v="small" style={{ marginBottom: 6 }}>/ 月</T> : null}
                      </Row>
                      <Row gap={6} style={{ marginTop: space.sm }}>
                        <RankBadge code={p.unlock_rank} size="sm" />
                        <T v="sub">{p.unlock_rank}ランクまで申し込み可能</T>
                      </Row>
                      <View style={{ marginTop: space.md, gap: 4 }}>
                        {p.perks.map((x) => (
                          <Row key={x} gap={6} style={{ alignItems: 'flex-start' }}>
                            <Icon name="check" size={14} color={colors.gold} />
                            <T v="small" style={{ flex: 1, color: colors.text }}>{x}</T>
                          </Row>
                        ))}
                      </View>
                      <Gap h={space.md} />
                      {current ? (
                        p.code !== 'FREE' ? (
                          ov.entitlement?.cancel_at_period_end ? (
                            <View style={{ gap: space.sm }}>
                              <T v="small">{dateLabel(ov.entitlement.current_period_end)} に終了予定</T>
                              <Button small variant="outline" title="自動更新を再開" onPress={resume} />
                            </View>
                          ) : (
                            <View style={{ gap: space.sm }}>
                              {ov.entitlement ? <T v="small">次回更新 {dateLabel(ov.entitlement.current_period_end)}</T> : null}
                              <Button small variant="quiet" title="自動更新を停止（解約）" onPress={cancel} testID={`cancel-${p.code}`} />
                            </View>
                          )
                        ) : null
                      ) : p.code === 'FREE' ? null : (
                        <Button small variant={p.code === 'BLACK' ? 'gold' : 'primary'} title="このプランにする" onPress={() => subscribe(p)} testID={`plan-${p.code}`} />
                      )}
                    </Card>
                  );
                })}
              </View>
              <T v="small" style={{ marginTop: space.md }}>会員プランは「申し込み資格」です。女性に会う義務や予約の成立を保証するものではありません。過度な課金は推奨していません。</T>
            </Section>

            <Section title="SPEND RANK ・ 利用実績ランク">
              <Card padded={false}>
                {ov.rank_rules.map((r, i) => (
                  <View key={r.code}>
                    {i > 0 ? <Divider /> : null}
                    <Row style={{ padding: space.lg, justifyContent: 'space-between' }}>
                      <Row gap={space.md}><RankBadge code={r.code} size="sm" locked={ov.spend_total < r.min_value} /><T v="body">{r.label}ランク</T></Row>
                      <T v="sub">確定利用額 {yen(r.min_value)} 以上</T>
                    </Row>
                  </View>
                ))}
              </Card>
            </Section>

            <Section title="LEVEL ・ 達成メーター">
              <LevelCard level={ov.level} xp={ov.xp} floor={ov.level_floor_xp} next={ov.next_level_xp} />
              <View style={{ marginTop: space.md }}><Badges badges={ov.badges} /></View>
            </Section>

            <Section title="HISTORY ・ 支払い履歴">
              {ov.payments.length === 0 ? <T v="sub">支払い履歴はまだありません。</T> : (
                <Card padded={false}>
                  {ov.payments.map((p, i) => (
                    <View key={p.id}>
                      {i > 0 ? <Divider /> : null}
                      <Row style={{ padding: space.lg, justifyContent: 'space-between' }}>
                        <View style={{ flex: 1 }}>
                          <T v="body">{p.kind === 'subscription' ? `${p.plan_code} プラン` : p.kind === 'booking' ? '予約' : 'デモ利用額（運営付与）'}</T>
                          <T v="small">{dateLabel(p.created_at)} ・ {PAYMENT_LABEL[p.status] ?? p.status}{p.is_sandbox ? ' ・ サンドボックス' : ''}</T>
                        </View>
                        <T v="h3">{yen(p.amount)}</T>
                      </Row>
                    </View>
                  ))}
                </Card>
              )}
            </Section>
          </>
        )}
      </Screen>
    </>
  );
}

function Path({ title, rank, active, text }: { title: string; rank: string; active: boolean; text: string }) {
  return (
    <View style={{ flex: 1, minWidth: 140, padding: space.md, borderRadius: 12, borderWidth: 1, borderColor: active ? colors.gold : colors.border, backgroundColor: active ? colors.goldWash : colors.surface }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="small" style={{ fontWeight: '600', color: colors.text }}>{title}</T>
        <RankBadge code={rank} size="sm" />
      </Row>
      <T v="small" style={{ marginTop: 6 }}>{text}</T>
      {active ? <T v="small" color={colors.goldDeep} style={{ marginTop: 2 }}>適用中</T> : null}
    </View>
  );
}
