import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Empty, ErrorState, LoadingList, Row, Segmented, T, useConfirm, useToast } from '@/components/ui';
import { call, toMessage, useRpc } from '@/lib/api';
import { relative } from '@/lib/format';
import { AdminPage, ROLE_LABEL, STATUS_PILL } from '@/screens/AdminKit';
import { colors, space } from '@/theme/tokens';

const CAT: Record<string, string> = { general: '一般', appeal: '異議申立て', payment: '支払い・返金', safety: '安全', deletion: '退会申請' };
type I = { id: string; category: string; body: string; status: string; admin_reply: string | null; created_at: string; user: { id: string; display_name: string; role: string; status: string } };

export default function Inquiries() {
  const [status, setStatus] = useState<'' | 'open' | 'answered' | 'closed'>('open');
  const res = useRpc<I[]>('admin_list_inquiries', { p_status: status || null });
  const toast = useToast();
  const confirm = useConfirm();
  const reply = async (id: string) => {
    const r = await confirm({ title: '回答する', confirm: '送信', input: { label: '回答内容（本人に表示）', required: true } });
    if (!r.ok) return;
    try {
      await call('admin_reply_inquiry', { p_id: id, p_reply: r.text, p_status: 'answered' });
      toast('回答しました');
      res.reload();
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  return (
    <AdminPage title="問い合わせ・異議申立て" refreshing={res.refreshing} onRefresh={res.refresh}>
      <Segmented value={status} onChange={setStatus} options={[{ value: 'open', label: '未対応' }, { value: 'answered', label: '回答済み' }, { value: 'closed', label: '完了' }, { value: '', label: 'すべて' }]} />
      <View style={{ marginTop: space.lg, gap: space.md }}>
        {res.loading ? <LoadingList /> : res.error ? <ErrorState message={res.error} onRetry={res.reload} /> : !res.data?.length ? <Empty icon="mail" title="該当する問い合わせはありません" /> : res.data.map((i) => (
          <Card key={i.id} style={i.category === 'appeal' ? { borderColor: colors.goldLight } : undefined}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h3">{CAT[i.category] ?? i.category}</T>
              {STATUS_PILL(i.status)}
            </Row>
            <T v="small">{i.user.display_name}（{ROLE_LABEL[i.user.role]}・{i.user.status}）・ {relative(i.created_at)}</T>
            <T v="body" style={{ marginTop: space.sm }}>{i.body}</T>
            {i.admin_reply ? <T v="small" style={{ marginTop: space.sm }}>回答：{i.admin_reply}</T> : null}
            <Row gap={space.sm} style={{ marginTop: space.md }}>
              <Button small title="回答する" onPress={() => reply(i.id)} />
              {i.status !== 'closed' ? <Button small variant="ghost" title="完了にする" onPress={async () => { await call('admin_reply_inquiry', { p_id: i.id, p_reply: i.admin_reply, p_status: 'closed' }); res.reload(); }} /> : null}
            </Row>
          </Card>
        ))}
      </View>
    </AdminPage>
  );
}
