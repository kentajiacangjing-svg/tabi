import { router } from 'expo-router';
import Constants from 'expo-constants';
import { View } from 'react-native';

import { Divider, Header, ListGroup, ListRow, Screen, Section, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { SUPABASE_URL } from '@/lib/supabase';
import { space } from '@/theme/tokens';

export default function Settings() {
  const { session } = useAuth();
  return (
    <>
      <Header title="設定" />
      <Screen>
        <Section title="ACCOUNT" style={{ marginTop: space.sm }}>
          <ListGroup>
            <ListRow icon="mail" title="メールアドレス" subtitle={session?.user.email ?? ''} />
            <Divider style={{ marginLeft: 64 }} />
            <ListRow icon="lock" title="パスワードを変更" onPress={() => router.push('/reset-password')} />
          </ListGroup>
        </Section>
        <Section title="POLICIES">
          <ListGroup>
            <ListRow icon="doc" title="利用規約" onPress={() => router.push('/legal/terms')} />
            <Divider style={{ marginLeft: 64 }} />
            <ListRow icon="doc" title="プライバシーポリシー" onPress={() => router.push('/legal/privacy')} />
            <Divider style={{ marginLeft: 64 }} />
            <ListRow icon="yen" title="料金について" onPress={() => router.push('/legal/pricing')} />
            <Divider style={{ marginLeft: 64 }} />
            <ListRow icon="shield" title="禁止事項・安全ガイド" onPress={() => router.push('/legal/guidelines')} />
          </ListGroup>
        </Section>
        <Section title="DATA">
          <ListGroup>
            <ListRow icon="trash" title="退会・データ削除の申請" danger onPress={() => router.push('/delete-account')} testID="menu-delete" />
          </ListGroup>
        </Section>
        <View style={{ marginTop: space.xl }}>
          <T v="small" center>バージョン {Constants.expoConfig?.version ?? '1.0.0'}（開発版）</T>
          <T v="small" center>接続先 {SUPABASE_URL.replace(/^https?:\/\//, '')}</T>
        </View>
      </Screen>
    </>
  );
}
