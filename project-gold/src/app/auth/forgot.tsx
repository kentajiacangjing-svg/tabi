import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Button, Field, Header, Notice, Screen, T } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { space } from '@/theme/tokens';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    const redirectTo = Platform.OS === 'web' ? `${window.location.origin}/reset-password` : Linking.createURL('/reset-password');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) setErr('送信できませんでした。時間をおいて再度お試しください');
    else setSent(true);
  };

  return (
    <>
      <Header title="パスワード再設定" />
      <Screen>
        <T v="title" style={{ marginTop: space.md }}>再設定メールを送信</T>
        <T v="sub" style={{ marginBottom: space.xl }}>登録したメールアドレスに、パスワード再設定用のリンクをお送りします。</T>
        {sent ? (
          <Notice tone="success" icon="mail" title="送信しました">
            メールが届かない場合は、迷惑メールフォルダもご確認ください。（ローカル開発環境では開発サーバーのログ／/dev/mailbox にリンクが表示されます）
          </Notice>
        ) : (
          <>
            {err ? <View style={{ marginBottom: space.lg }}><Notice tone="danger" icon="alert">{err}</Notice></View> : null}
            <Field label="メールアドレス" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" testID="forgot-email" />
            <Button title="送信する" onPress={submit} disabled={!/\S+@\S+\.\S+/.test(email)} testID="forgot-submit" />
          </>
        )}
      </Screen>
    </>
  );
}
