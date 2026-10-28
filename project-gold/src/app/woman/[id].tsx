import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Badges, Carousel, SlotRow } from '@/components/blocks';
import { Icon } from '@/components/Icon';
import {
  Button, Card, Divider, Empty, ErrorState, Field, Gap, Header, IconButton, LoadingList, Notice, Pill, RankBadge, Row, Screen,
  Section, Sheet, T, useConfirm, useToast,
} from '@/components/ui';
import { call, toMessage, useRpc } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { durationLabel, rangeLabel, yen } from '@/lib/format';
import type { Slot, WomanDetail } from '@/lib/types';
import { colors, space } from '@/theme/tokens';

export default function WomanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const res = useRpc<WomanDetail>('get_woman_detail', { p_woman: id });
  const { refreshMe } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [slot, setSlot] = useState<Slot | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [msg, setMsg] = useState('');
  const w = res.data;

  const request = async () => {
    if (!slot) return;
    try {
      const r = await call<{ id: string }>('request_booking', { p_slot: slot.id, p_message: msg });
      setSlot(null);
      setMsg('');
      toast('予約申請を送りました。承認をお待ちください');
      res.reload();
      router.push(`/booking/${r.id}`);
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  const apply = async () => {
    try {
      await call('submit_application', { p_woman: id, p_message: msg });
      setApplyOpen(false);
      setMsg('');
      toast('プロフィール申請を送りました');
      res.reload();
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  const block = async () => {
    setMenu(false);
    const r = await confirm({ title: `${w?.display_name}さんをブロックしますか？`, message: 'お互いに表示・メッセージ・申し込みができなくなります。進行中の申請・予約はキャンセルされます。', confirm: 'ブロックする', danger: true });
    if (!r.ok) return;
    try {
      await call('block_user', { p_target: id });
      toast('ブロックしました');
      router.back();
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };

  const elig = w?.eligibility;
  const reasons = elig?.reasons ?? [];
  const has = (c: string) => reasons.some((r) => r.code === c);

  return (
    <>
      <Header title={w?.display_name ?? ''} right={<IconButton name="flag" label="その他の操作" onPress={() => setMenu(true)} />} />
      <Screen padded={false}>
        {res.loading ? <View style={{ padding: space.lg }}><LoadingList count={2} h={300} /></View> : res.error || !w ? (
          <ErrorState message={res.error ?? '見つかりません'} onRetry={res.reload} />
        ) : (
          <>
            <Carousel paths={w.photos} />
            <View style={{ paddingHorizontal: space.lg }}>
              <Row style={{ justifyContent: 'space-between', marginTop: space.xl, alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <T v="display">{w.display_name}</T>
                  <T v="sub">{[w.area, ...w.areas.filter((a) => a !== w.area)].join('・')} ・ Lv.{w.level}</T>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <RankBadge code={w.rank_code} size="lg" locked={elig?.rank_locked} />
                  <T v="small" style={{ marginTop: 2 }}>{w.rank_code}ランク</T>
                </View>
              </Row>
              {w.headline ? <T v="h3" style={{ marginTop: space.lg }}>{w.headline}</T> : null}
              <Row gap={6} wrap style={{ marginTop: space.md }}>
                <Pill label={w.accept_mode === 'open' ? '幅広く受け付けています' : '自分で選ぶ（承認制）'} tone={w.accept_mode === 'open' ? 'gold' : 'neutral'} />
                {w.plan_types.map((p) => <Pill key={p} label={p} />)}
              </Row>
              {w.venue ? (
                <Row style={{ marginTop: space.md }} gap={6}>
                  <Icon name="store" size={16} color={colors.goldDeep} />
                  <T v="sub">{w.venue.name}（{w.venue.area}）・ 運営確認済み</T>
                </Row>
              ) : null}

              <EligibilityBlock w={w} has={has} onApply={() => setApplyOpen(true)} onVerify={async () => { await refreshMe(); router.push('/verification'); }} />

              {w.conversation_id ? (
                <View style={{ marginTop: space.lg }}>
                  <Button variant="outline" icon="chat" title="メッセージ" onPress={() => router.push(`/chat/${w.conversation_id}`)} />
                </View>
              ) : null}

              <Section title="ABOUT">
                <T v="body" selectable>{w.bio || '自己紹介はまだありません。'}</T>
                {w.badges?.length ? <View style={{ marginTop: space.lg }}><Badges badges={w.badges} /></View> : null}
              </Section>

              <Section title="SCHEDULE ・ 空き枠">
                {w.slots.length === 0 ? (
                  <Empty icon="calendar" title="現在公開中の空き枠はありません" text="空き枠が追加されると、ここに表示されます。" />
                ) : (
                  <Card padded={false} style={{ paddingHorizontal: space.lg }}>
                    {w.slots.map((s, i) => (
                      <View key={s.id}>
                        {i > 0 ? <Divider /> : null}
                        <SlotRow
                          start={s.start_at} end={s.end_at} plan={s.plan_type} area={s.area} price={s.price}
                          right={s.my_request === 'requested' ? <Pill label="申請中" tone="gold" /> : (
                            <Button small variant={elig?.can_request ? 'primary' : 'quiet'} title={elig?.can_request ? '申し込む' : '条件あり'} testID={`slot-${i}`}
                              onPress={() => (elig?.can_request ? setSlot(s) : toast(reasons[0]?.message ?? '現在申し込みできません', 'info'))} />
                          )}
                        />
                      </View>
                    ))}
                  </Card>
                )}
                <T v="small" style={{ marginTop: space.sm }}>表示価格はデモ用の仮設定です。予約はお相手の承認後に確定します。</T>
              </Section>
              <Gap h={space.xl} />
            </View>
          </>
        )}
      </Screen>

      <Sheet visible={!!slot} onClose={() => setSlot(null)} title="予約内容の確認">
        {slot ? (
          <>
            <Card>
              <T v="caption">BOOKING</T>
              <T v="h2" style={{ marginTop: 4 }}>{w?.display_name}さん</T>
              <Gap h={space.sm} />
              <Row style={{ justifyContent: 'space-between' }}><T v="sub">日時</T><T v="body">{rangeLabel(slot.start_at, slot.end_at)}</T></Row>
              <Row style={{ justifyContent: 'space-between' }}><T v="sub">内容</T><T v="body">{slot.plan_type}（{durationLabel(slot.start_at, slot.end_at)}）</T></Row>
              <Row style={{ justifyContent: 'space-between' }}><T v="sub">エリア</T><T v="body">{slot.area}</T></Row>
              <Divider style={{ marginVertical: space.md }} />
              <Row style={{ justifyContent: 'space-between' }}><T v="h3">お支払い（デモ）</T><T v="num" style={{ fontSize: 24 }}>{yen(slot.price)}</T></Row>
            </Card>
            <Gap h={space.md} />
            <Field label="メッセージ（任意）" value={msg} onChangeText={setMsg} placeholder="はじめまして。当日はよろしくお願いします。" multiline maxLength={500} testID="request-message" />
            <Notice icon="info">
              お相手の承認後に予約が確定し、サンドボックスの与信が行われます（実際の請求はありません）。完了時に利用額として計上されます。開始24時間前まではキャンセル料はかかりません（仮設定）。
            </Notice>
            <Gap h={space.lg} />
            <Button title="この内容で申請する" onPress={request} testID="request-submit" />
          </>
        ) : null}
      </Sheet>

      <Sheet visible={applyOpen} onClose={() => setApplyOpen(false)} title="プロフィール申請">
        <T v="sub" style={{ marginBottom: space.lg }}>{w?.display_name}さんは「自分で選ぶ」モードです。申請が承認されると、メッセージと予約申請ができるようになります。</T>
        <Field label="ひとこと" value={msg} onChangeText={setMsg} placeholder="自己紹介やお誘いの内容を簡単に" multiline maxLength={500} testID="apply-message" />
        <Button title="申請を送る" onPress={apply} testID="apply-submit" />
      </Sheet>

      <Sheet visible={menu} onClose={() => setMenu(false)} title="その他の操作">
        <View style={{ gap: space.sm }}>
          <Button variant="quiet" icon="flag" title="通報する" onPress={() => { setMenu(false); router.push({ pathname: '/report', params: { target: id, name: w?.display_name } }); }} />
          <Button variant="quiet" icon="block" title="ブロックする" onPress={block} />
        </View>
      </Sheet>
    </>
  );

}

function EligibilityBlock({ w, has, onApply, onVerify }: { w: WomanDetail; has: (c: string) => boolean; onApply: () => void; onVerify: () => void }) {
  const e = w.eligibility;
  if (!e) return null;
  if (e.can_request) {
    return (
      <View style={{ marginTop: space.lg }}>
        <Notice tone="success" icon="unlock" title="申し込みできます">
          {e.application_source === 'invite' ? '招待リンクから参加しているため、ランク条件にかかわらず申し込めます。' : '空き枠を選んで予約申請してください。'}
        </Notice>
      </View>
    );
  }
  return (
    <Card style={{ marginTop: space.lg, borderColor: colors.goldLight }}>
      <Row gap={space.sm}>
        <Icon name="lock" size={18} color={colors.goldDeep} />
        <T v="h3">申し込みの条件</T>
      </Row>
      <View style={{ marginTop: space.sm, gap: 6 }}>
        {w.eligibility?.reasons.map((r) => (
          <Row key={r.code} gap={6} style={{ alignItems: 'flex-start' }}>
            <T v="sub" color={colors.goldDeep}>・</T>
            <T v="sub" style={{ flex: 1 }}>{r.message}</T>
          </Row>
        ))}
      </View>
      {has('RANK_LOCKED') ? (
        <>
          <T v="small" style={{ marginTop: space.md }}>
            現在は {e.access.unlocked_rank} ランクまで申し込めます。会員プランの変更、または利用実績（確定利用額）で解放できます。解放は申し込み資格であり、予約の成立を保証するものではありません。
          </T>
          <View style={{ marginTop: space.md }}><Button variant="gold" title="解放方法を見る" onPress={() => router.push('/membership')} testID="unlock-cta" /></View>
        </>
      ) : null}
      {has('VERIFY_REQUIRED') ? <View style={{ marginTop: space.md }}><Button variant="outline" title="本人確認へ進む" onPress={onVerify} /></View> : null}
      {has('APPROVAL_REQUIRED') && e.can_apply ? <View style={{ marginTop: space.md }}><Button title="プロフィール申請を送る" onPress={onApply} testID="apply-cta" /></View> : null}
      {has('APPROVAL_REQUIRED') && e.application_status === 'pending' ? <View style={{ marginTop: space.md }}><Pill label="申請済み・承認待ち" tone="gold" /></View> : null}
    </Card>
  );
}
