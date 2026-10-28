import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Check, Field, Gap, Header, Notice, Pill, Row, Screen, Section, T, useToast } from '@/components/ui';
import { call, toMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Me } from '@/lib/types';
import { colors, space } from '@/theme/tokens';

const STATUS = {
  unsubmitted: { label: '未提出', tone: 'neutral' as const },
  pending: { label: '審査中', tone: 'gold' as const },
  approved: { label: '確認済み', tone: 'success' as const },
  rejected: { label: '要再提出', tone: 'danger' as const },
};

export default function Verification() {
  const { me, setMe, settings } = useAuth();
  const toast = useToast();
  const [year, setYear] = useState('');
  const [consent, setConsent] = useState(false);
  if (!me) return null;
  const st = me.verification.status;
  const minAge = Number(settings?.settings?.min_age ?? 20);

  const submit = async () => {
    try {
      const m = await call<Me>('submit_verification', { p_birth_year: Number(year), p_consent: consent });
      setMe(m);
      toast(m.verification.status === 'approved' ? '本人確認が完了しました（デモ）' : '本人確認を受け付けました。審査をお待ちください');
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };

  return (
    <>
      <Header title="本人確認" />
      <Screen>
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="caption">VERIFICATION</T>
            <Pill label={STATUS[st].label} tone={STATUS[st].tone} icon="shield" />
          </Row>
          <T v="h2" style={{ marginTop: space.sm }}>年齢確認・本人確認</T>
          <T v="sub" style={{ marginTop: 4 }}>
            ご利用は{minAge}歳以上の本人確認済みの方に限ります。確認が完了するまで、申し込み・予約・プロフィール公開はできません。
          </T>
        </Card>

        {st === 'approved' ? (
          <View style={{ marginTop: space.lg }}><Notice tone="success" icon="check" title="確認済み">本人確認は完了しています。</Notice></View>
        ) : st === 'pending' ? (
          <View style={{ marginTop: space.lg }}><Notice icon="clock" title="審査中">運営が確認しています。結果は通知でお知らせします。</Notice></View>
        ) : (
          <>
            {st === 'rejected' ? <View style={{ marginTop: space.lg }}><Notice tone="danger" icon="alert" title="再提出が必要です">{me.verification.rejection_reason ?? ''}</Notice></View> : null}
            <Section title="DEMO ・ テスト提出">
              <Notice icon="info" title="開発版のテスト連携です">
                本番では、認可を受けた本人確認サービス（eKYC）で公的書類と顔写真を照合し、書類画像は本アプリに保存しない設計を予定しています。開発版では生年のみを送信し、運営が承認します。
              </Notice>
              <Gap h={space.lg} />
              <Field label="生まれた年（西暦）" value={year} onChangeText={(t) => setYear(t.replace(/[^0-9]/g, '').slice(0, 4))} keyboardType="number-pad" placeholder="1995" testID="verify-year" />
              <Check checked={consent} onChange={setConsent} testID="verify-consent">
                <T v="sub" color={colors.text}>本人確認のために情報を提供することに同意します。虚偽の申告は利用停止の対象となることを理解しました。</T>
              </Check>
              <Gap h={space.md} />
              <Button title="提出する" onPress={submit} disabled={year.length !== 4 || !consent} testID="verify-submit" />
            </Section>
          </>
        )}

        <Section title="PRIVACY ・ 取り扱い">
          <T v="sub">・本人確認書類の画像はアプリ内に保存しません（本番は外部 eKYC 事業者の結果のみを保持予定）。</T>
          <T v="sub">・相手方に公開されるのは「本人確認済み」という表示のみです。</T>
          <T v="sub">・年齢要件・確認手続きの最終的な扱いは、公開前の法令確認で確定します。</T>
        </Section>
      </Screen>
    </>
  );
}
