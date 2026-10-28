import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { TopBar } from '@/components/blocks';
import { Avatar, Card, Empty, ErrorState, LoadingList, Row, Screen, Segmented, StatusPill, T } from '@/components/ui';
import { useRpc } from '@/lib/api';
import { rangeLabel, yen } from '@/lib/format';
import type { BookingListItem } from '@/lib/types';
import { space } from '@/theme/tokens';

type Scope = 'upcoming' | 'pending' | 'past';

export function BookingsList({ title = '予約' }: { title?: string }) {
  const [scope, setScope] = useState<Scope>('upcoming');
  const res = useRpc<BookingListItem[]>('list_my_bookings', { p_scope: scope });
  const { reload } = res;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return (
    <>
      <TopBar title={title} />
      <Screen refreshing={res.refreshing} onRefresh={res.refresh}>
        <Segmented value={scope} onChange={setScope} options={[{ value: 'upcoming', label: '確定済み' }, { value: 'pending', label: '承認待ち' }, { value: 'past', label: '履歴' }]} />
        <View style={{ marginTop: space.lg, gap: space.md }}>
          {res.loading ? <LoadingList /> : res.error ? <ErrorState message={res.error} onRetry={res.reload} /> : !res.data?.length ? (
            <Empty
              icon="calendar"
              title={scope === 'upcoming' ? '確定済みの予約はありません' : scope === 'pending' ? '承認待ちの申請はありません' : '履歴はまだありません'}
              text={scope === 'pending' ? '申請はお相手が承認すると「確定済み」に移動します。' : undefined}
            />
          ) : (
            res.data.map((b) => (
              <Card key={b.id} onPress={() => router.push(`/booking/${b.id}`)} accessibilityLabel={`${b.counterpart.display_name}との予約`}>
                <Row gap={space.md}>
                  <Avatar path={b.counterpart.photos[0]} size={52} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <T v="h3" numberOfLines={1} style={{ flex: 1 }}>{b.counterpart.display_name}</T>
                      <StatusPill status={b.status} />
                    </Row>
                    <T v="sub">{rangeLabel(b.start_at, b.end_at)}</T>
                    <T v="small">{b.plan_type} ・ {b.area} ・ {yen(b.price)}</T>
                  </View>
                </Row>
              </Card>
            ))
          )}
        </View>
      </Screen>
    </>
  );
}
