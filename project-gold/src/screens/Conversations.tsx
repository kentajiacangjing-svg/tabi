import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { TopBar } from '@/components/blocks';
import { Avatar, Empty, ErrorState, ListGroup, LoadingList, Row, Screen, T, Divider } from '@/components/ui';
import { useRpc } from '@/lib/api';
import { relative } from '@/lib/format';
import { useLive } from '@/lib/live';
import type { Conversation } from '@/lib/types';
import { colors, space } from '@/theme/tokens';

export function Conversations({ emptyText }: { emptyText: string }) {
  const res = useRpc<Conversation[]>('list_conversations');
  const { reload } = res;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  useLive('conv-list', 'messages', null, res.reload, 6000);
  return (
    <>
      <TopBar title="メッセージ" />
      <Screen refreshing={res.refreshing} onRefresh={res.refresh}>
        {res.loading ? <LoadingList count={4} h={72} /> : res.error ? <ErrorState message={res.error} onRetry={res.reload} /> : !res.data?.length ? (
          <Empty icon="chat" title="メッセージはまだありません" text={emptyText} />
        ) : (
          <ListGroup>
            {res.data.map((c, i) => (
              <View key={c.id}>
                {i > 0 ? <Divider style={{ marginLeft: 76 }} /> : null}
                <Pressable testID={`conv-${c.id}`} accessibilityRole="button" accessibilityLabel={`${c.counterpart.display_name}とのメッセージ`} onPress={() => router.push(`/chat/${c.id}`)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bg }]}>
                  <Avatar path={c.counterpart.photos[0]} size={48} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <T v="h3" numberOfLines={1} style={{ flex: 1 }}>{c.counterpart.display_name}</T>
                      {c.last_message ? <T v="small">{relative(c.last_message.created_at)}</T> : null}
                    </Row>
                    <Row>
                      <T v="sub" numberOfLines={1} style={{ flex: 1 }}>
                        {!c.can_chat ? '現在メッセージできません' : c.last_message ? `${c.last_message.mine ? 'あなた：' : ''}${c.last_message.body}` : 'メッセージを送ってみましょう'}
                      </T>
                      {c.unread ? <View style={styles.unread}><T v="small" color="#fff" style={{ fontWeight: '700', fontSize: 11 }}>{c.unread}</T></View> : null}
                    </Row>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  unread: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
