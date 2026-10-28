import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Check, Field, Header, Notice, Row, Screen, T, useToast } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors, space } from '@/theme/tokens';

export default function SignUp() {
  const { role } = useLocalSearchParams<{ role?: string }>();
  const r = role === 'woman' ? 'woman' : 'man';
  const { signUp } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [adult, setAdult] = useState(false);
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const valid = name.trim().length > 0 && /\S+@\S+\.\S+/.test(email) && pw.length >= 8 && adult && agree;

  const submit = async () => {
    setErr(null);
    try {
      await signUp(email, pw, r, name);
      toast('登録が完了しました');
      router.replace('/');
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <>
      <Header title={r === 'woman' ? '女性として登録' : '男性として登録'} />
      <Screen footer={<Button title="登録する" onPress={submit} disabled={!valid} testID="signup-submit" />}>
        <T v="title" style={{ marginTop: space.md }}>アカウント作成</T>
        <T v="sub" style={{ marginBottom: space.xl }}>{r === 'woman' ? '登録・基本利用は無料です。' : '登録は無料です。会員プランはあとから選べます。'}</T>
        {err ? <View style={{ marginBottom: space.lg }}><Notice tone="danger" icon="alert">{err}</Notice></View> : null}
        <Field label="表示名（ニックネーム）" value={name} onChangeText={setName} placeholder="例：みさき" maxLength={30} autoComplete="nickname" testID="signup-name" hint="本名は入力しないでください" />
        <Field label="メールアドレス" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" testID="signup-email" />
        <Field label="パスワード（8文字以上）" value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" testID="signup-password" />
        <Check checked={adult} onChange={setAdult} testID="signup-adult">
          <T v="sub" color={colors.text}>20歳以上です</T>
        </Check>
        <Check checked={agree} onChange={setAgree} testID="signup-agree">
          <T v="sub" color={colors.text}>
            <Link href="/legal/terms" style={styles.link}>利用規約</Link>・<Link href="/legal/privacy" style={styles.link}>プライバシーポリシー</Link>・<Link href="/legal/guidelines" style={styles.link}>禁止事項</Link>に同意します
          </T>
        </Check>
        <Row style={{ marginTop: space.lg, justifyContent: 'center' }}>
          <T v="sub">アカウントをお持ちの方は </T>
          <Link href="/auth/sign-in" style={[styles.link, { fontSize: 13.5 }]}>ログイン</Link>
        </Row>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  link: { color: colors.goldDeep, textDecorationLine: 'underline' },
});
