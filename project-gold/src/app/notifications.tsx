import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Divider, Empty, ErrorState, Header, ListGroup, LoadingList, Row, Screen, T } from '@/components/ui';
import { call, useRpc } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { relative } from '@/lib/format';
import { useLive } from '@/lib/live';
import type { Notification } from '@/lib/types';
import { colors, space } from '@/theme/tokens';

const ICON: Record<string, IconName> = { booking: 'calendar', application: 'users', message: 'chat', membership: 'crown', earning: 'yen', verification: 'shield', invite: 'qr', payment: 'card', support: 'mail', system: 'info' };

export default function Notifications() {
  const res = useRpc<Notification[]>('list_notifications', { p_limit: 100 });
  const { refreshMe } = useAuth();
  useLive('notif', 'notifications', null, res.reload, 8000);
  useEffect(() => {
    if (res.data?.some((n) => !n.read_at)) call('mark_notifications_read').then(refreshMe).catch(() => {});
  }, [res.data, refreshMe]);
  return (
    <>
      <Header title="通知" />
      <Screen refreshing={res.refreshing} onRefresh={res.refresh}>
        {res.loading ? <LoadingList count={5} h={64} /> : res.error ? <ErrorState message={res.error} onRetry={res.reload} /> : !res.data?.length ? (
          <Empty icon="bell" title="通知はありません" />
        ) : (
          <ListGroup>
            {res.data.map((n, i) => (
              <View key={n.id}>
                {i > 0 ? <Divider style={{ marginLeft: 64 }} /> : null}
                <Pressable onPress={() => n.link && router.push(n.link as Href)} disabled={!n.link} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bg }]} accessibilityRole={n.link ? 'button' : undefined}>
                  <View style={styles.icon}><Icon name={ICON[n.kind] ?? 'bell'} size={18} color={colors.goldDeep} /></View>
                  <View style={{ flex: 1 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <T v="h3" style={{ flex: 1, fontSize: 14.5 }}>{n.title}</T>
                      {!n.read_at ? <View style={styles.unread} /> : null}
                    </Row>
                    {n.body ? <T v="sub">{n.body}</T> : null}
                    <T v="small" style={{ marginTop: 2 }}>{relative(n.created_at)}</T>
                  </View>
                </Pressable>
              </View>
            ))}
          </ListGroup>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, padding: space.lg, alignItems: 'flex-start' },
  icon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.goldWash, alignItems: 'center', justifyContent: 'center' },
  unread: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
});
