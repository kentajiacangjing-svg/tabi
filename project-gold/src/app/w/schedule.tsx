import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { SlotRow, TopBar } from '@/components/blocks';
import { Button, Card, Divider, Empty, ErrorState, LoadingList, Notice, Pill, Screen, T, useConfirm, useToast } from '@/components/ui';
import { call, toMessage, useRpc } from '@/lib/api';
import type { Slot } from '@/lib/types';
import { space } from '@/theme/tokens';

export default function Schedule() {
  const res = useRpc<Slot[]>('list_my_slots');
  const toast = useToast();
  const confirm = useConfirm();
  const { reload } = res;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  const close = async (s: Slot) => {
    const r = await confirm({ title: 'この枠の受付を終了しますか？', message: s.pending_requests ? `承認待ちの申請 ${s.pending_requests}件は不成立として通知されます。` : undefined, confirm: '受付を終了', danger: true });
    if (!r.ok) return;
    try {
      res.setData(await call<Slot[]>('close_slot', { p_id: s.id }));
      toast('受付を終了しました');
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  return (
    <>
      <TopBar title="日程" />
      <Screen refreshing={res.refreshing} onRefresh={res.refresh}>
        <Button icon="plus" title="空き枠を追加" onPress={() => router.push('/schedule-new')} testID="slot-new" />
        <View style={{ marginTop: space.md }}>
          <Notice tone="neutral" icon="info">提供時間・希望料金はあなたが決めます。料金は現在テスト用（疑似決済）で、実際の販売は契約・法令確認後に開始します。</Notice>
        </View>
        <View style={{ marginTop: space.lg }}>
          {res.loading ? <LoadingList /> : res.error ? <ErrorState message={res.error} onRetry={res.reload} /> : !res.data?.length ? (
            <Empty icon="calendar" title="公開中の空き枠はありません" text="空き枠を追加すると、男性会員が予約申請できるようになります。" />
          ) : (
            <Card padded={false} style={{ paddingHorizontal: space.lg }}>
              {res.data.map((s, i) => (
                <View key={s.id}>
                  {i > 0 ? <Divider /> : null}
                  <SlotRow
                    start={s.start_at} end={s.end_at} plan={s.plan_type} area={s.area} price={s.price}
                    right={s.status === 'booked' ? <Pill label="予約確定" tone="dark" /> : (
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        {s.pending_requests ? <Pill label={`申請 ${s.pending_requests}`} tone="gold" /> : <Pill label="受付中" />}
                        <Button small variant="ghost" title="終了" onPress={() => close(s)} />
                      </View>
                    )}
                  />
                  {s.note ? <T v="small" style={{ marginTop: -6, marginBottom: space.sm, marginLeft: 52 }}>{s.note}</T> : null}
                </View>
              ))}
            </Card>
          )}
        </View>
      </Screen>
    </>
  );
}
