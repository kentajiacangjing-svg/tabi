import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Field, Gap, Header, Notice, Row, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors, space } from '@/theme/tokens';

const DEMO = [
  { label: '男性（FREE）', email: 'taro@demo.projectgold.local' },
  { label: '男性（GOLD）', email: 'kenichi@demo.projectgold.local' },
  { label: '女性（Sランク）', email: 'misaki@demo.projectgold.local' },
  { label: '女性（Cランク）', email: 'yui@demo.projectgold.local' },
  { label: '運営', email: 'admin@demo.projectgold.local' },
];

export default function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e = email, p = pw) => {
    setErr(null);
    try {
      await signIn(e, p);
      router.replace('/');
    } catch (x) {
      setErr((x as Error).message);
    }
  };

  return (
    <>
      <Header title="ログイン" />
      <Screen>
        <T v="title" style={{ marginTop: space.md, marginBottom: space.xl }}>おかえりなさい</T>
        {err ? <View style={{ marginBottom: space.lg }}><Notice tone="danger" icon="alert">{err}</Notice></View> : null}
        <Field label="メールアドレス" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" testID="login-email" />
        <Field label="パスワード" value={pw} onChangeText={setPw} secureTextEntry autoComplete="current-password" onSubmitEditing={() => submit()} testID="login-password" />
        <Button title="ログイン" onPress={() => submit()} disabled={!email || !pw} testID="login-submit" />
        <Row style={{ justifyContent: 'center', marginTop: space.lg }}>
          <Link href="/auth/forgot" style={styles.link}>パスワードをお忘れの方</Link>
        </Row>
        <Row style={{ justifyContent: 'center', marginTop: space.sm }}>
          <Link href="/auth/role" style={styles.link}>新規登録はこちら</Link>
        </Row>
        {__DEV__ || process.env.EXPO_PUBLIC_SHOW_DEMO_LOGIN === 'on' ? (
          <>
            <Gap h={space.xxl} />
            <Card>
              <T v="caption">DEMO ACCOUNTS</T>
              <T v="small" style={{ marginTop: 4, marginBottom: space.md }}>開発環境のデモアカウント（パスワード DemoPass123!）。本番ビルドでは表示されません。</T>
              <View style={{ gap: space.sm }}>
                {DEMO.map((d) => (
                  <Button key={d.email} small variant="quiet" title={d.label} onPress={() => submit(d.email, 'DemoPass123!')} testID={`demo-${d.email.split('@')[0]}`} />
                ))}
              </View>
            </Card>
          </>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({ link: { color: colors.goldDeep, fontSize: 13.5, paddingVertical: 6 } });
