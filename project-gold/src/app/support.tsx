import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, Field, Header, Pill, Row, Screen, Section, T, useToast } from '@/components/ui';
import { call, toMessage, useRpc } from '@/lib/api';
import { relative } from '@/lib/format';
import { space } from '@/theme/tokens';

const CATS = [
  { v: 'general', l: '一般的なお問い合わせ' },
  { v: 'appeal', l: '利用停止・審査への異議申立て' },
  { v: 'payment', l: 'お支払い・返金' },
  { v: 'safety', l: '安全に関するご相談' },
];

type Inq = { id: string; category: string; body: string; status: string; admin_reply: string | null; created_at: string };

export default function Support() {
  const toast = useToast();
  const list = useRpc<Inq[]>('list_my_inquiries');
  const [cat, setCat] = useState('general');
  const [body, setBody] = useState('');
  const submit = async () => {
    try {
      await call('submit_inquiry', { p_category: cat, p_body: body });
      setBody('');
      toast('お問い合わせを受け付けました');
      list.reload();
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  return (
    <>
      <Header title="問い合わせ・異議申立て" />
      <Screen>
        <Section title="NEW" style={{ marginTop: space.sm }}>
          <Row wrap gap={space.sm} style={{ marginBottom: space.lg }}>{CATS.map((c) => <Chip key={c.v} label={c.l} selected={cat === c.v} onPress={() => setCat(c.v)} />)}</Row>
          <Field label="内容" value={body} onChangeText={setBody} multiline maxLength={3000} placeholder="できるだけ具体的にご記入ください" testID="support-body" />
          <Button title="送信する" onPress={submit} disabled={body.trim().length < 5} testID="support-submit" />
        </Section>
        <Section title="HISTORY">
          {!list.data?.length ? <T v="sub">お問い合わせ履歴はありません。</T> : (
            <View style={{ gap: space.md }}>
              {list.data.map((i) => (
                <Card key={i.id}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T v="small">{CATS.find((c) => c.v === i.category)?.l ?? (i.category === 'deletion' ? '退会申請' : i.category)} ・ {relative(i.created_at)}</T>
                    <Pill label={{ open: '受付', answered: '回答済み', closed: '完了' }[i.status] ?? i.status} tone={i.status === 'answered' ? 'success' : 'gold'} />
                  </Row>
                  <T v="body" style={{ marginTop: space.sm }}>{i.body}</T>
                  {i.admin_reply ? <View style={{ marginTop: space.md, padding: space.md, backgroundColor: '#F6F1E7', borderRadius: 12 }}><T v="small">運営からの回答</T><T v="body">{i.admin_reply}</T></View> : null}
                </Card>
              ))}
            </View>
          )}
        </Section>
      </Screen>
    </>
  );
}
