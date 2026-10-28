import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Card, Check, Field, Header, Notice, Screen, Section, T, useConfirm, useToast } from '@/components/ui';
import { call, toMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, space } from '@/theme/tokens';

export default function DeleteAccount() {
  const { refreshMe } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [reason, setReason] = useState('');
  const [ok, setOk] = useState(false);
  const submit = async () => {
    const r = await confirm({ title: '退会を申請しますか？', message: 'この操作は取り消せません。進行中の申請・予約はすべてキャンセルされます。', confirm: '退会を申請する', danger: true });
    if (!r.ok) return;
    try {
      await call('request_account_deletion', { p_reason: reason });
      await refreshMe();
      toast('退会申請を受け付けました');
      router.replace('/');
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  return (
    <>
      <Header title="退会・データ削除" />
      <Screen>
        <Card style={{ marginTop: space.sm }}>
          <T v="h2">退会すると</T>
          <T v="sub" style={{ marginTop: space.sm }}>・プロフィールは直ちに非公開になり、進行中の申請・予約はキャンセルされます。</T>
          <T v="sub">・運営による処理後、表示名・写真・自己紹介・メッセージ本文などの個人情報を削除・匿名化します。</T>
          <T v="sub">・取引記録（予約・決済・報酬台帳）は、法令・紛争対応のため匿名化した状態で一定期間保管します。</T>
          <T v="sub">・会員プランの自動更新は停止されます。</T>
        </Card>
        <Section title="REASON">
          <Field label="退会理由（任意）" value={reason} onChangeText={setReason} multiline maxLength={1000} testID="delete-reason" />
          <Check checked={ok} onChange={setOk} testID="delete-confirm">
            <T v="sub" color={colors.text}>上記の内容を理解しました</T>
          </Check>
        </Section>
        <Notice tone="danger" icon="alert">この操作は取り消せません。</Notice>
        <Button style={{ marginTop: space.lg }} variant="danger" title="退会を申請する" onPress={submit} disabled={!ok} testID="delete-submit" />
      </Screen>
    </>
  );
}
