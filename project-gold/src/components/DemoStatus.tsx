import { useSyncExternalStore } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button, Notice, Row, T } from '@/components/ui';
import { demoStatusApi, resetDemo } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';

const noop = () => () => {};
const none = () => null;

/** ブラウザ完結デモのデータベース準備状況（デモ版以外では何も表示しない） */
export function DemoStatus({ compact }: { compact?: boolean }) {
  const s = useSyncExternalStore(demoStatusApi?.subscribe ?? noop, demoStatusApi?.get ?? none, demoStatusApi?.get ?? none);
  if (!s) return null;
  if (s.phase === 'loading') {
    return (
      <View style={{ marginVertical: space.md }}>
        <Notice icon="clock" title="デモの準備中です">
          <Row gap={space.sm} style={{ marginTop: 2 }}>
            <ActivityIndicator size="small" color={colors.gold} />
            <T v="sub" color={colors.text} style={{ flex: 1 }}>{s.step}…</T>
          </Row>
          <T v="small" style={{ marginTop: 4 }}>初回はデータベースの読み込みに30秒〜1分ほどかかります。この間もログインボタンは押せますが、完了まで待ってから進みます。</T>
        </Notice>
      </View>
    );
  }
  if (s.phase === 'error') {
    return (
      <View style={{ marginVertical: space.md }}>
        <Notice tone="danger" icon="alert" title="デモを起動できませんでした">
          <T v="sub" color={colors.text}>{s.message}</T>
          <Row gap={space.sm} wrap style={{ marginTop: space.sm }}>
            <Button small title="もう一度試す" onPress={() => { demoStatusApi?.retry().catch(() => {}); }} />
            <Button small variant="quiet" title="データを消してやり直す" onPress={() => resetDemo?.()} />
          </Row>
        </Notice>
      </View>
    );
  }
  if (compact) return null;
  return (
    <View style={{ marginVertical: space.md }}>
      <Notice tone="success" icon="check" title="デモの準備ができました">
        {s.persistent ? 'データはこの端末のブラウザに保存されます。' : 'この画面では端末内に保存できないため、再読み込みするとデモデータは最初の状態に戻ります。'}
      </Notice>
    </View>
  );
}
