import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Chip, Field, Header, Notice, Row, Screen, Section, T, useToast } from '@/components/ui';
import { call, toMessage } from '@/lib/api';
import { space } from '@/theme/tokens';

const CATS = [
  { v: 'prohibited_service', l: '性的サービス等の要求・勧誘' },
  { v: 'solicitation', l: '求人・スカウト・勧誘' },
  { v: 'harassment', l: '迷惑行為・脅迫・つきまとい' },
  { v: 'safety', l: '身の危険を感じた' },
  { v: 'underage', l: '未成年の疑い' },
  { v: 'fake_profile', l: 'なりすまし・虚偽のプロフィール' },
  { v: 'no_show', l: '無断キャンセル' },
  { v: 'other', l: 'その他' },
];

export default function Report() {
  const { target, name, booking, message } = useLocalSearchParams<{ target: string; name?: string; booking?: string; message?: string }>();
  const toast = useToast();
  const [cat, setCat] = useState('');
  const [detail, setDetail] = useState('');
  const submit = async () => {
    try {
      await call('report_user', { p_target: target, p_category: cat, p_detail: detail, p_booking: booking || null, p_message: message ? Number(message) : null });
      toast('通報を受け付けました。運営が確認します');
      router.back();
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  return (
    <>
      <Header title="通報する" />
      <Screen footer={<Button title="通報を送信" onPress={submit} disabled={!cat} testID="report-submit" />}>
        <T v="sub" style={{ marginTop: space.sm }}>{name ? `${name}さん` : 'このお相手'}について、運営に報告します。通報したことは相手に通知されません。</T>
        {message ? <View style={{ marginTop: space.md }}><Notice icon="chat" tone="neutral">対象のメッセージを添付して送信します。</Notice></View> : null}
        <Section title="CATEGORY">
          <Row wrap gap={space.sm}>{CATS.map((c) => <Chip key={c.v} label={c.l} selected={cat === c.v} onPress={() => setCat(c.v)} />)}</Row>
        </Section>
        <Section title="DETAIL">
          <Field label="詳しい状況（任意）" value={detail} onChangeText={setDetail} multiline maxLength={2000} testID="report-detail" />
        </Section>
        <Notice tone="danger" icon="alert" title="緊急の場合">身の危険がある場合は、ためらわずに110番へ通報してください。</Notice>
      </Screen>
    </>
  );
}
