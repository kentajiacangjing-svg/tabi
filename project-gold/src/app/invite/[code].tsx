import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Empty, Header, LoadingList, Notice, Screen, T, useToast } from '@/components/ui';
import { call, toMessage, useRpc } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { space } from '@/theme/tokens';

type Preview = { woman_id: string; display_name: string; headline: string } | null;

/** 女性が既存のお客様へ共有する招待リンク。共有は本人が任意で行う */
export default function Invite() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { me, session } = useAuth();
  const toast = useToast();
  const res = useRpc<Preview>('get_share_link_preview', { p_code: code });
  const join = async () => {
    try {
      const r = await call<{ woman_id: string }>('redeem_share_link', { p_code: code });
      toast('プロフィールに参加しました');
      router.replace(`/woman/${r.woman_id}`);
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  return (
    <>
      <Header title="招待" />
      <Screen>
        {res.loading ? <LoadingList count={1} /> : !res.data ? <Empty icon="alert" title="この招待リンクは無効です" text="リンクの有効期限が切れているか、再発行された可能性があります。" /> : (
          <>
            <Card style={{ marginTop: space.md }}>
              <T v="caption">INVITATION</T>
              <T v="title" style={{ marginTop: space.sm }}>{res.data.display_name}さんからの招待</T>
              {res.data.headline ? <T v="sub" style={{ marginTop: 4 }}>{res.data.headline}</T> : null}
              <T v="sub" style={{ marginTop: space.md }}>参加すると、{res.data.display_name}さんへメッセージ・予約申請ができるようになります（予約はお相手の承認で成立します）。</T>
            </Card>
            <View style={{ marginTop: space.xl, gap: space.sm }}>
              {!session ? (
                <>
                  <Notice icon="info">男性会員として登録・ログインしたあと、もう一度このリンクを開いてください。</Notice>
                  <Button title="新規登録" onPress={() => router.push({ pathname: '/auth/sign-up', params: { role: 'man' } })} />
                  <Button variant="outline" title="ログイン" onPress={() => router.push('/auth/sign-in')} />
                </>
              ) : me?.role !== 'man' ? (
                <Notice tone="neutral">招待リンクは男性会員向けです。</Notice>
              ) : (
                <Button title="参加する" onPress={join} testID="invite-join" />
              )}
            </View>
          </>
        )}
      </Screen>
    </>
  );
}
