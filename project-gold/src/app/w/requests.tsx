import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { TopBar } from '@/components/blocks';
import { Avatar, Button, Card, Empty, ErrorState, LoadingList, Pill, Row, Screen, Segmented, T, useConfirm, useToast } from '@/components/ui';
import { call, toMessage, useRpc } from '@/lib/api';
import { durationLabel, rangeLabel, relative, yen } from '@/lib/format';
import { useLive } from '@/lib/live';
import type { Incoming, ManSummary } from '@/lib/types';
import { colors, space } from '@/theme/tokens';

type Tab = 'bookings' | 'applications' | 'customers';

export default function Requests() {
  const [tab, setTab] = useState<Tab>('bookings');
  const res = useRpc<Incoming>('list_incoming');
  const toast = useToast();
  const confirm = useConfirm();
  const { reload } = res;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  useLive('incoming', 'notifications', null, res.reload, 8000);
  const x = res.data;

  const accept = async (id: string, when: string) => {
    const r = await confirm({ title: 'この申請を承認しますか？', message: `${when} の予約が確定します。`, confirm: '承認する' });
    if (!r.ok) return;
    try {
      await call('accept_booking', { p_id: id });
      toast('予約を確定しました');
      res.reload();
    } catch (e) {
      toast(toMessage(e), 'error');
      res.reload();
    }
  };
  const decline = async (id: string) => {
    const r = await confirm({ title: '辞退しますか？', message: 'お相手には「今回はご希望に添えませんでした」とだけ通知されます。', confirm: '辞退する', input: { label: '理由（任意・非公開）' } });
    if (!r.ok) return;
    try {
      await call('decline_booking', { p_id: id, p_reason: r.text });
      toast('辞退しました');
      res.reload();
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  const decide = async (id: string, approve: boolean) => {
    try {
      res.setData(await call<Incoming>('decide_application', { p_id: id, p_approve: approve }));
      toast(approve ? '承認しました。メッセージと予約申請ができるようになります' : '見送りました');
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };

  return (
    <>
      <TopBar title="申込" />
      <Screen refreshing={res.refreshing} onRefresh={res.refresh}>
        <Segmented value={tab} onChange={setTab} options={[
          { value: 'bookings', label: `予約申請${x?.bookings.length ? ` ${x.bookings.length}` : ''}` },
          { value: 'applications', label: `プロフィール申請${x?.applications.length ? ` ${x.applications.length}` : ''}` },
          { value: 'customers', label: 'お客様' },
        ]} />
        <View style={{ marginTop: space.lg, gap: space.md }}>
          {res.loading ? <LoadingList /> : res.error || !x ? <ErrorState message={res.error ?? ''} onRetry={res.reload} /> : tab === 'bookings' ? (
            x.bookings.length === 0 ? <Empty icon="inbox" title="新しい予約申請はありません" text="空き枠を追加すると、申請が届くようになります。" action={<Button small variant="outline" title="日程を追加" onPress={() => router.push('/schedule-new')} />} /> :
            x.bookings.map((b) => (
              <Card key={b.id}>
                <ManRow man={b.man} />
                <View style={{ marginTop: space.md, padding: space.md, backgroundColor: colors.bg, borderRadius: 12 }}>
                  <T v="h3">{rangeLabel(b.start_at, b.end_at)}</T>
                  <T v="small">{b.plan_type}（{durationLabel(b.start_at, b.end_at)}）・ {b.area} ・ {yen(b.price)}</T>
                </View>
                {b.message ? <T v="sub" style={{ marginTop: space.md }}>「{b.message}」</T> : null}
                <T v="small" style={{ marginTop: space.sm }}>{relative(b.created_at)}に申請</T>
                <Row gap={space.sm} style={{ marginTop: space.md }}>
                  <Button small style={{ flex: 1 }} title="承認する" onPress={() => accept(b.id, rangeLabel(b.start_at, b.end_at))} testID={`accept-${b.id}`} />
                  <Button small style={{ flex: 1 }} variant="quiet" title="辞退する" onPress={() => decline(b.id)} testID={`decline-${b.id}`} />
                </Row>
                <Button small variant="ghost" title="詳細を見る" onPress={() => router.push(`/booking/${b.id}`)} />
              </Card>
            ))
          ) : tab === 'applications' ? (
            x.applications.length === 0 ? <Empty icon="users" title="新しいプロフィール申請はありません" text="「自分で選ぶ」モードでは、承認した方だけが予約申請できます。" /> :
            x.applications.map((a) => (
              <Card key={a.id}>
                <ManRow man={a.man} />
                {a.message ? <T v="sub" style={{ marginTop: space.md }}>「{a.message}」</T> : null}
                <T v="small" style={{ marginTop: space.sm }}>{relative(a.created_at)}に申請</T>
                <Row gap={space.sm} style={{ marginTop: space.md }}>
                  <Button small style={{ flex: 1 }} title="承認する" onPress={() => decide(a.id, true)} testID={`app-approve-${a.id}`} />
                  <Button small style={{ flex: 1 }} variant="quiet" title="見送る" onPress={() => decide(a.id, false)} />
                </Row>
              </Card>
            ))
          ) : (
            x.customers.length === 0 ? <Empty icon="qr" title="まだお客様はいません" text="紹介用リンク・QR から既存のお客様を招待できます。" action={<Button small variant="outline" title="紹介用リンクを開く" onPress={() => router.push('/share')} />} /> :
            x.customers.map((c) => (
              <Card key={c.man.id}>
                <ManRow man={c.man} extra={c.source === 'invite' ? <Pill label="招待から参加" tone="gold" icon="qr" /> : null} />
                {c.conversation_id ? <Button small variant="outline" icon="chat" title="メッセージ" style={{ marginTop: space.md }} onPress={() => router.push(`/chat/${c.conversation_id}`)} /> : null}
              </Card>
            ))
          )}
        </View>
      </Screen>
    </>
  );
}

function ManRow({ man, extra }: { man: ManSummary; extra?: React.ReactNode }) {
  return (
    <View>
      <Row gap={space.md}>
        <Avatar path={man.photos[0]} size={48} />
        <View style={{ flex: 1, gap: 4 }}>
          <T v="h3">{man.display_name}</T>
          <Row gap={6} wrap>
            <Pill label={`Lv.${man.level}`} />
            {man.verified ? <Pill label="本人確認済み" tone="success" icon="shield" /> : <Pill label="本人確認未完了" tone="danger" />}
            <Pill label={`完了 ${man.completed}回`} />
            {extra}
          </Row>
        </View>
      </Row>
      {man.bio ? <T v="small" style={{ marginTop: space.sm }} numberOfLines={3}>{man.bio}</T> : null}
    </View>
  );
}
