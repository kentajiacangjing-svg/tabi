import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Button, ErrorState, Header, IconButton, LoadingList, Notice, Sheet, T, useConfirm, useToast } from '@/components/ui';
import { call, toMessage } from '@/lib/api';
import { relative, timeLabel } from '@/lib/format';
import { useLive } from '@/lib/live';
import type { Message, Role } from '@/lib/types';
import { colors, maxWidth, radius, space } from '@/theme/tokens';

type Thread = { can_chat: boolean; counterpart: { id: string; display_name: string; role: Role; photos: string[] }; messages: Message[] };

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const confirm = useConfirm();
  const [thread, setThread] = useState<Thread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState<null | 'thread' | Message>(null);
  const list = useRef<FlatList<Message>>(null);
  const lastId = useRef(0);

  const load = useCallback(async (initial = false) => {
    try {
      const t = await call<Thread>('get_messages', { p_conversation: id, p_after: initial ? 0 : lastId.current });
      setThread((prev) => {
        const merged = initial || !prev ? t.messages : [...prev.messages, ...t.messages.filter((m) => !prev.messages.some((p) => p.id === m.id))];
        lastId.current = merged.length ? merged[merged.length - 1].id : 0;
        return { ...t, messages: merged };
      });
      setError(null);
    } catch (e) {
      setError(toMessage(e));
    }
  }, [id]);

  useEffect(() => { load(true); }, [load]);
  // アクセス権がない（エラー）場合はポーリングしない
  useLive(thread ? `chat-${id}` : null, 'messages', `conversation_id=eq.${id}`, () => load(false), 3000);
  useEffect(() => {
    if (thread?.messages.length) setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
  }, [thread?.messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await call('send_message', { p_conversation: id, p_body: body });
      setText('');
      await load(false);
    } catch (e) {
      toast(toMessage(e), 'error');
    } finally {
      setSending(false);
    }
  };

  const block = async () => {
    setMenu(null);
    if (!thread) return;
    const r = await confirm({ title: `${thread.counterpart.display_name}さんをブロックしますか？`, message: 'メッセージの送受信・閲覧ができなくなり、進行中の申請・予約はキャンセルされます。', confirm: 'ブロックする', danger: true });
    if (!r.ok) return;
    try {
      await call('block_user', { p_target: thread.counterpart.id });
      toast('ブロックしました');
      router.back();
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={thread?.counterpart.display_name ?? 'メッセージ'} right={<IconButton name="flag" label="その他の操作" onPress={() => setMenu('thread')} />} />
      {error && !thread ? <ErrorState message={error} onRetry={() => load(true)} /> : !thread ? <View style={{ padding: space.lg }}><LoadingList count={4} h={44} /></View> : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
          <FlatList
            ref={list}
            data={thread.messages}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={[styles.listContent, { maxWidth }]}
            ListHeaderComponent={
              <View style={{ marginBottom: space.lg }}>
                <Notice icon="shield" tone="neutral">
                  連絡先の交換や、性的サービス・金銭の個別取引のお誘いは禁止です。不快なメッセージは長押しで通報できます。
                </Notice>
              </View>
            }
            ListEmptyComponent={<T v="sub" center style={{ marginTop: space.xl }}>最初のメッセージを送ってみましょう</T>}
            renderItem={({ item, index }) => {
              const prev = thread.messages[index - 1];
              const showTime = !prev || new Date(item.created_at).getTime() - new Date(prev.created_at).getTime() > 15 * 60000;
              return (
                <View>
                  {showTime ? <T v="small" center style={{ marginVertical: space.sm }}>{relative(item.created_at)}</T> : null}
                  <Pressable onLongPress={() => !item.mine && setMenu(item)} delayLongPress={350} accessibilityHint={!item.mine ? '長押しで通報' : undefined}
                    style={[styles.bubbleRow, item.mine ? { justifyContent: 'flex-end' } : null]}>
                    <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
                      <T v="body" color={item.mine ? '#fff' : colors.text} selectable>{item.body}</T>
                    </View>
                  </Pressable>
                  <T v="small" style={[{ fontSize: 10.5, marginTop: 2 }, item.mine ? { textAlign: 'right' } : null]}>{timeLabel(item.created_at)}</T>
                </View>
              );
            }}
          />
          {thread.can_chat ? (
            <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
              <View style={[styles.inputRow, { maxWidth }]}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="メッセージを入力"
                  placeholderTextColor={colors.faint}
                  multiline
                  maxLength={2000}
                  style={styles.input}
                  accessibilityLabel="メッセージ入力"
                  testID="chat-input"
                  onKeyPress={(e) => {
                    const ne = e.nativeEvent as unknown as { key: string; shiftKey?: boolean; isComposing?: boolean };
                    if (Platform.OS === 'web' && ne.key === 'Enter' && !ne.shiftKey && !ne.isComposing) {
                      (e as unknown as { preventDefault: () => void }).preventDefault();
                      send();
                    }
                  }}
                />
                <Pressable onPress={send} disabled={!text.trim() || sending} accessibilityRole="button" accessibilityLabel="送信" testID="chat-send"
                  style={[styles.send, (!text.trim() || sending) && { opacity: 0.35 }]}>
                  <Icon name="send" size={20} color="#fff" />
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, space.md), paddingHorizontal: space.lg }]}>
              <Notice tone="neutral" icon="lock">現在このお相手とはメッセージできません。</Notice>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
      <Sheet visible={!!menu} onClose={() => setMenu(null)} title={menu === 'thread' ? 'その他の操作' : 'このメッセージ'}>
        <View style={{ gap: space.sm }}>
          {menu && menu !== 'thread' ? <T v="sub" style={{ marginBottom: space.sm }} numberOfLines={3}>「{menu.body}」</T> : null}
          <Button variant="quiet" icon="flag" title={menu === 'thread' ? '通報する' : 'このメッセージを通報する'} onPress={() => {
            const m = menu;
            setMenu(null);
            if (thread) router.push({ pathname: '/report', params: { target: thread.counterpart.id, name: thread.counterpart.display_name, message: m && m !== 'thread' ? String(m.id) : '' } });
          }} />
          <Button variant="quiet" icon="block" title="ブロックする" onPress={block} />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: space.lg, gap: 4, width: '100%', alignSelf: 'center', flexGrow: 1 },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg },
  mine: { backgroundColor: colors.text, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderBottomLeftRadius: 6 },
  inputBar: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface, paddingTop: space.sm },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.md, width: '100%', alignSelf: 'center' },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 16, color: colors.text },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
});
