import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DemoStatus } from '@/components/DemoStatus';
import { Button, Card, Field, Header, Notice, Row, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { DEMO_BROWSER, resetDemo } from '@/lib/supabase';
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

  const showDemo = __DEV__ || DEMO_BROWSER || process.env.EXPO_PUBLIC_SHOW_DEMO_LOGIN === 'on';
  const demoCard = showDemo ? (
    <View style={{ marginVertical: space.lg }}>
      <Card>
        <T v="caption">DEMO ACCOUNTS</T>
        <T v="small" style={{ marginTop: 4, marginBottom: space.md }}>ボタンを押すとそのアカウントで入れます（パスワード DemoPass123!）。本番では表示されません。</T>
        <View style={{ gap: space.sm }}>
          {DEMO.map((d) => (
            <Button key={d.email} small variant="quiet" title={d.label} onPress={() => submit(d.email, 'DemoPass123!')} testID={`demo-${d.email.split('@')[0]}`} />
          ))}
        </View>
        {DEMO_BROWSER ? (
          <>
            <T v="small" style={{ marginTop: space.lg }}>このデモはサーバーを使わず、ブラウザの中だけで動いています。登録した内容はこの端末にだけ保存され、他の人には見えません。</T>
            <Button small variant="ghost" title="デモデータを初期状態に戻す" onPress={() => resetDemo?.()} />
          </>
        ) : null}
      </Card>
    </View>
  ) : null;

  return (
    <>
      <Header title="ログイン" />
      <Screen>
        <T v="title" style={{ marginTop: space.md, marginBottom: space.xl }}>おかえりなさい</T>
        <DemoStatus />
        {DEMO_BROWSER ? demoCard : null}
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
        {!DEMO_BROWSER ? demoCard : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({ link: { color: colors.goldDeep, fontSize: 13.5, paddingVertical: 6 } });
