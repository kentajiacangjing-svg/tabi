import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Divider, Header, ListGroup, Notice, Row, Screen, Section, T, useToast } from '@/components/ui';
import { call, toMessage, useRpc } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { relative } from '@/lib/format';
import { space } from '@/theme/tokens';

type Blocked = { id: string; display_name: string; created_at: string };

export default function Safety() {
  const { me } = useAuth();
  const toast = useToast();
  const res = useRpc<Blocked[]>('list_blocks');
  const unblock = async (id: string) => {
    try {
      await call('unblock_user', { p_target: id });
      toast('ブロックを解除しました');
      res.reload();
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  return (
    <>
      <Header title="安全設定" />
      <Screen>
        <Section title="SAFETY ・ 安全のために" style={{ marginTop: space.sm }}>
          <Card>
            <T v="sub">・はじめてお会いする際は、人目のある飲食店などを選びましょう。</T>
            <T v="sub">・自宅や勤務先、正確な住所は伝えないようにしましょう。</T>
            <T v="sub">・アプリ外での金銭のやりとりや、性的サービスの要求には応じず、通報してください。</T>
            {me?.role === 'woman' ? <T v="sub">・予約はいつでも辞退・キャンセル・ブロックできます。受付条件は「受付モード・受付条件」から変更できます。</T> : null}
            <T v="sub">・身の危険を感じた場合は、ためらわずに110番へ連絡してください。</T>
          </Card>
          {me?.role === 'woman' ? <View style={{ marginTop: space.md }}><Button variant="outline" title="受付モード・受付条件を開く" onPress={() => router.push('/accept-settings')} /></View> : null}
        </Section>
        <Section title="BLOCKED ・ ブロック中のユーザー">
          {!res.data?.length ? <Notice tone="neutral" icon="block">ブロックしているユーザーはいません。</Notice> : (
            <ListGroup>
              {res.data.map((b, i) => (
                <View key={b.id}>
                  {i > 0 ? <Divider /> : null}
                  <Row style={{ padding: space.lg, justifyContent: 'space-between' }}>
                    <View><T v="body">{b.display_name}</T><T v="small">{relative(b.created_at)}にブロック</T></View>
                    <Button small variant="quiet" title="解除" onPress={() => unblock(b.id)} />
                  </Row>
                </View>
              ))}
            </ListGroup>
          )}
        </Section>
        <Section title="REPORT">
          <Button variant="quiet" icon="mail" title="安全について運営に相談する" onPress={() => router.push('/support')} />
        </Section>
      </Screen>
    </>
  );
}
