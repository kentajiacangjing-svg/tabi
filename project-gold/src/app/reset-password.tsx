import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Field, Header, Notice, Screen, T, useToast } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { space } from '@/theme/tokens';

/** 再設定リンクからの遷移、またはログイン中のパスワード変更 */
export default function ResetPassword() {
  const { session, clearRecovery } = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return setErr('変更できませんでした。リンクの有効期限が切れている可能性があります');
    clearRecovery();
    toast('パスワードを変更しました');
    router.replace('/');
  };

  return (
    <>
      <Header title="新しいパスワード" />
      <Screen>
        <T v="title" style={{ marginTop: space.md, marginBottom: space.xl }}>パスワードを設定</T>
        {!session ? (
          <Notice tone="danger" icon="alert">リンクが無効か、有効期限が切れています。もう一度再設定メールを送信してください。</Notice>
        ) : (
          <>
            {err ? <View style={{ marginBottom: space.lg }}><Notice tone="danger" icon="alert">{err}</Notice></View> : null}
            <Field label="新しいパスワード（8文字以上）" value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" testID="reset-pw" />
            <Field label="確認のためもう一度" value={pw2} onChangeText={setPw2} secureTextEntry autoComplete="new-password" error={pw2 && pw !== pw2 ? '一致しません' : null} testID="reset-pw2" />
            <Button title="変更する" disabled={pw.length < 8 || pw !== pw2} onPress={submit} testID="reset-submit" />
          </>
        )}
      </Screen>
    </>
  );
}
