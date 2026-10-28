import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Empty, Field, Screen, T, useToast } from '@/components/ui';
import { call, toMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { space } from '@/theme/tokens';

export default function AccountStatus() {
  const { me, signOut } = useAuth();
  const toast = useToast();
  const [appeal, setAppeal] = useState('');
  const [sent, setSent] = useState(false);
  const deleting = me?.status === 'deletion_requested' || me?.status === 'deleted';
  const send = async () => {
    try {
      await call('submit_inquiry', { p_category: 'appeal', p_body: appeal });
      setSent(true);
      toast('異議申立てを受け付けました');
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  return (
    <Screen>
      <View style={{ marginTop: space.xxxl * 1.5 }}>
        <Empty
          icon={deleting ? 'check' : 'alert'}
          title={deleting ? '退会申請を受け付けました' : 'アカウントは一時停止中です'}
          text={deleting ? '運営が処理を行います。ご利用ありがとうございました。' : me?.status_reason ?? '利用規約に関する確認のため、一時的にご利用を停止しています。'}
        />
        {!deleting ? (
          sent ? <T v="sub" center style={{ marginBottom: space.lg }}>運営からの回答をお待ちください。</T> : (
            <View style={{ marginBottom: space.lg }}>
              <Field label="異議申立て" value={appeal} onChangeText={setAppeal} multiline maxLength={3000} placeholder="停止の理由に心当たりがない場合など、状況をご記入ください" testID="appeal-body" />
              <Button variant="primary" title="異議申立てを送る" onPress={send} disabled={appeal.trim().length < 5} testID="appeal-submit" />
            </View>
          )
        ) : null}
        <Button variant="outline" title="ログアウト" onPress={async () => { await signOut(); router.replace('/'); }} testID="status-logout" />
      </View>
    </Screen>
  );
}
