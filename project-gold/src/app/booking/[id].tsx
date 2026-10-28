import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Avatar, Button, Card, Divider, ErrorState, Gap, Header, LoadingList, Notice, Pill, RankBadge, Row, Screen, Section, StatusPill, T, useConfirm, useToast } from '@/components/ui';
import { call, toMessage, useRpc } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateLabel, durationLabel, PAYMENT_LABEL, rangeLabel, STATUS_LABEL, timeLabel, yen } from '@/lib/format';
import type { BookingDetail } from '@/lib/types';
import { colors, space } from '@/theme/tokens';

export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const res = useRpc<BookingDetail>('get_booking', { p_id: id });
  const { refreshMe } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const b = res.data;
  const [now] = useState(() => Date.now());

  const act = async (fn: string, args: Record<string, unknown>, ok: string) => {
    try {
      res.setData(await call<BookingDetail>(fn, { p_id: id, ...args }));
      refreshMe();
      toast(ok);
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };

  if (res.loading) return <><Header title="予約詳細" /><Screen><LoadingList /></Screen></>;
  if (!b) return <><Header title="予約詳細" /><Screen><ErrorState message={res.error ?? ''} onRetry={res.reload} /></Screen></>;

  const isMan = b.my_side === 'man';
  const isWoman = b.my_side === 'woman';
  const started = new Date(b.start_at).getTime() <= now;
  const lateHours = (new Date(b.start_at).getTime() - now) / 3600000;

  const actions: React.ReactNode[] = [];
  if (isWoman && b.status === 'requested') {
    actions.push(<Button key="acc" title="承認して予約を確定する" testID="booking-accept" onPress={async () => {
      const r = await confirm({ title: 'この申請を承認しますか？', message: `${rangeLabel(b.start_at, b.end_at)} の予約が確定します。確定後も、やむを得ない場合はキャンセル・ブロックできます。`, confirm: '承認する' });
      if (r.ok) act('accept_booking', {}, '予約を確定しました');
    }} />);
    actions.push(<Button key="dec" variant="quiet" title="辞退する" testID="booking-decline" onPress={async () => {
      const r = await confirm({ title: '申請を辞退しますか？', message: 'お相手には「今回はご希望に添えませんでした」と通知されます（理由は任意・お相手には表示されません）。', confirm: '辞退する', input: { label: '辞退理由（任意・非公開）' } });
      if (r.ok) act('decline_booking', { p_reason: r.text }, '辞退しました');
    }} />);
  }
  if (isWoman && b.status === 'accepted') {
    actions.push(<Button key="done" title="完了にする" testID="booking-complete" onPress={async () => {
      const r = await confirm({ title: '予約を完了にしますか？', message: started ? '支払いが確定し、報酬が台帳に記録されます（サンドボックス）。' : 'まだ開始時刻前です（デモ環境のため完了操作を許可しています）。支払いが確定し、報酬が記録されます。', confirm: '完了にする' });
      if (r.ok) act('complete_booking', {}, '完了しました。実績に反映されました');
    }} />);
  }
  if (b.status === 'requested' && isMan) {
    actions.push(<Button key="wd" variant="quiet" title="申請を取り下げる" onPress={async () => {
      const r = await confirm({ title: '申請を取り下げますか？', confirm: '取り下げる', danger: true });
      if (r.ok) act('cancel_booking', { p_reason: 'withdrawn' }, '申請を取り下げました');
    }} />);
  }
  if (b.status === 'accepted' && (isMan || isWoman)) {
    const pol = b.cancellation_policy;
    const late = isMan && lateHours < (pol?.free_until_hours ?? 24) && (pol?.late_fee_rate ?? 0) > 0;
    actions.push(<Button key="cx" variant="quiet" title="予約をキャンセルする" testID="booking-cancel" onPress={async () => {
      const r = await confirm({
        title: '予約をキャンセルしますか？',
        message: late ? `開始${pol.free_until_hours}時間前を過ぎているため、キャンセル料（${Math.round(pol.late_fee_rate * 100)}%）が発生します（仮設定）。` : 'キャンセル料はかかりません（仮設定）。お相手に通知されます。',
        confirm: 'キャンセルする', danger: true, input: { label: '理由（任意）' },
      });
      if (r.ok) act('cancel_booking', { p_reason: r.text }, 'キャンセルしました');
    }} />);
  }
  if ((b.status === 'accepted' || b.status === 'completed') && (isMan || isWoman)) {
    actions.push(<Button key="dis" variant="ghost" title="トラブルを申し立てる" onPress={async () => {
      const r = await confirm({ title: '運営に申し立てますか？', message: '予約は「申立て中」になり、運営が双方の状況を確認します。', confirm: '申し立てる', danger: true, input: { label: '状況を具体的にご記入ください', required: true } });
      if (r.ok) act('open_dispute', { p_reason: r.text }, '申立てを受け付けました');
    }} />);
  }
  if (isMan && b.status === 'completed' && b.payment?.status === 'captured' && !b.refund) {
    actions.push(<Button key="rf" variant="ghost" title="返金を申請する" onPress={async () => {
      const r = await confirm({ title: '返金を申請しますか？', message: '運営が内容を確認のうえ判断します（サンドボックス）。', confirm: '申請する', input: { label: '理由', required: true } });
      if (r.ok) {
        try {
          res.setData(await call<BookingDetail>('request_refund', { p_booking: id, p_reason: r.text }));
          toast('返金申請を受け付けました');
        } catch (e) {
          toast(toMessage(e), 'error');
        }
      }
    }} />);
  }

  const other = isMan ? { name: b.woman.display_name, photo: b.woman.photos[0], id: b.woman.id } : { name: b.man.display_name, photo: b.man.photos[0], id: b.man.id };

  return (
    <>
      <Header title="予約詳細" />
      <Screen refreshing={res.refreshing} onRefresh={res.refresh}>
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="caption">BOOKING</T>
            <StatusPill status={b.status} />
          </Row>
          <T v="title" style={{ marginTop: space.sm }}>{dateLabel(b.start_at)}</T>
          <T v="num" style={{ fontSize: 26 }}>{timeLabel(b.start_at)} – {timeLabel(b.end_at)}</T>
          <T v="sub">{b.plan_type}（{durationLabel(b.start_at, b.end_at)}）・ {b.area}</T>
          <Divider style={{ marginVertical: space.lg }} />
          <Row gap={space.md}>
            <Avatar path={other.photo} size={48} />
            <View style={{ flex: 1 }}>
              <T v="h3">{other.name}</T>
              {isMan ? (
                <Row gap={6}><RankBadge code={b.woman.rank_code} size="sm" /><T v="small">{b.woman.area}</T></Row>
              ) : (
                <Row gap={6} wrap>
                  <Pill label={`Lv.${b.man.level}`} />
                  {b.man.verified ? <Pill label="本人確認済み" tone="success" icon="shield" /> : null}
                  <Pill label={`完了 ${b.man.completed}回`} />
                </Row>
              )}
            </View>
            {isMan ? <Button small variant="quiet" title="プロフィール" onPress={() => router.push(`/woman/${b.woman.id}`)} /> : null}
          </Row>
          {b.message ? <View style={{ marginTop: space.md, padding: space.md, backgroundColor: colors.bg, borderRadius: 12 }}><T v="small">申請時のメッセージ</T><T v="body">{b.message}</T></View> : null}
        </Card>

        {b.status === 'requested' ? <Gap h={space.md} /> : null}
        {b.status === 'requested' && isWoman ? <Notice icon="info">承認するまで予約は確定しません。「幅広く受け付ける」モードでも自動では確定されません。</Notice> : null}
        {b.status === 'requested' && isMan ? <Notice icon="clock">お相手の承認をお待ちください。承認されると通知でお知らせします。</Notice> : null}
        {b.status === 'declined' ? <View style={{ marginTop: space.md }}><Notice tone="neutral">{isMan ? '今回はご希望に添えませんでした。' : `辞退済み${b.decline_reason ? `（${b.decline_reason}）` : ''}`}</Notice></View> : null}
        {b.status === 'disputed' ? <View style={{ marginTop: space.md }}><Notice tone="danger" icon="alert" title="申立て中">運営が確認しています。結果は通知でお知らせします。</Notice></View> : null}

        <Section title={isMan ? 'PAYMENT ・ お支払い' : 'EARNING ・ 報酬'}>
          <Card>
            {isMan || b.my_side === 'admin' ? (
              <>
                <Row style={{ justifyContent: 'space-between' }}><T v="sub">予約金額</T><T v="h3">{yen(b.price)}</T></Row>
                <Row style={{ justifyContent: 'space-between', marginTop: 6 }}><T v="sub">決済状態</T><T v="body">{b.payment ? PAYMENT_LABEL[b.payment.status] : '承認後に与信'}</T></Row>
                {b.refund ? <Row style={{ justifyContent: 'space-between', marginTop: 6 }}><T v="sub">返金</T><T v="body">{({ requested: '申請中', approved: '承認', rejected: '却下', processed: '返金済み' } as Record<string, string>)[b.refund.status]}（{yen(b.refund.amount)}）</T></Row> : null}
              </>
            ) : (
              <>
                <Row style={{ justifyContent: 'space-between' }}><T v="sub">提示価格</T><T v="h3">{yen(b.price)}</T></Row>
                {b.earning?.net !== null && b.earning?.net !== undefined ? (
                  <>
                    <Row style={{ justifyContent: 'space-between', marginTop: 6 }}><T v="sub">手数料</T><T v="body">−{yen(b.earning.fee)}</T></Row>
                    <Row style={{ justifyContent: 'space-between', marginTop: 6 }}><T v="sub">確定報酬</T><T v="h3" color={colors.goldDeep}>{yen(b.earning.net)}</T></Row>
                  </>
                ) : <T v="small" style={{ marginTop: 6 }}>完了時に報酬が確定します。</T>}
              </>
            )}
            <Row gap={6} style={{ marginTop: space.md }}>
              <Icon name="info" size={14} color={colors.goldDeep} />
              <T v="small" style={{ flex: 1 }}>サンドボックス（疑似決済）です。実際の請求・送金は行われません。</T>
            </Row>
          </Card>
        </Section>

        {actions.length ? <View style={{ gap: space.sm, marginTop: space.xl }}>{actions}</View> : null}
        {b.conversation_id && ['accepted', 'completed', 'disputed'].includes(b.status) ? (
          <View style={{ marginTop: space.sm }}><Button variant="outline" icon="chat" title="メッセージ" onPress={() => router.push(`/chat/${b.conversation_id}`)} testID="booking-chat" /></View>
        ) : null}

        <Section title="HISTORY ・ 状態の履歴">
          <Card>
            {b.events.map((e, i) => (
              <Row key={i} gap={space.md} style={{ alignItems: 'flex-start', paddingVertical: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 7, backgroundColor: i === b.events.length - 1 ? colors.gold : colors.border }} />
                <View style={{ flex: 1 }}>
                  <T v="body">{STATUS_LABEL[e.to]}</T>
                  <T v="small">{dateLabel(e.at)} {timeLabel(e.at)} ・ {e.by === 'man' ? (isMan ? 'あなた' : '男性') : e.by === 'woman' ? (isWoman ? 'あなた' : '女性') : 'システム'}</T>
                </View>
              </Row>
            ))}
          </Card>
        </Section>
        <View style={{ marginTop: space.xl }}>
          <Button variant="ghost" icon="flag" title="このお相手を通報する" onPress={() => router.push({ pathname: '/report', params: { target: other.id, name: other.name, booking: b.id } })} />
        </View>
      </Screen>
    </>
  );
}
