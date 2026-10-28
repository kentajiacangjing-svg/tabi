import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Empty, ErrorState, LoadingList, Row, Segmented, T, useConfirm, useToast } from '@/components/ui';
import { call, toMessage, useRpc } from '@/lib/api';
import { relative } from '@/lib/format';
import { AdminPage, ROLE_LABEL, STATUS_PILL } from '@/screens/AdminKit';
import { colors, space } from '@/theme/tokens';

const CAT: Record<string, string> = {
  prohibited_service: '性的サービス等', solicitation: '求人・勧誘', harassment: '迷惑・脅迫', safety: '安全', underage: '未成年の疑い',
  fake_profile: 'なりすまし', no_show: '無断キャンセル', other: 'その他', booking_dispute: '予約の申立て',
};

type R = { id: string; category: string; detail: string; status: string; admin_note: string; created_at: string; booking_id: string | null; message: string | null;
  reporter: { id: string; display_name: string; role: string }; target: { id: string; display_name: string; role: string; status: string } };

export default function Reports() {
  const [status, setStatus] = useState<'' | 'open' | 'reviewing' | 'actioned' | 'dismissed'>('open');
  const res = useRpc<R[]>('admin_list_reports', { p_status: status || null });
  const toast = useToast();
  const confirm = useConfirm();
  const update = async (id: string, st: string, suspend = false) => {
    const r = await confirm({ title: suspend ? '対応済みにして相手を停止しますか？' : '状態を更新しますか？', confirm: '更新する', danger: suspend, input: { label: '対応メモ（監査ログ・停止理由に使用）', required: suspend } });
    if (!r.ok) return;
    try {
      await call('admin_update_report', { p_id: id, p_status: st, p_note: r.text, p_suspend: suspend });
      toast('更新しました');
      res.reload();
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  return (
    <AdminPage title="通報" subtitle="通報 → 審査 → 停止のワークフロー" refreshing={res.refreshing} onRefresh={res.refresh}>
      <Segmented value={status} onChange={setStatus} options={[{ value: 'open', label: '未対応' }, { value: 'reviewing', label: '確認中' }, { value: 'actioned', label: '対応済み' }, { value: 'dismissed', label: '対象外' }, { value: '', label: 'すべて' }]} />
      <View style={{ marginTop: space.lg, gap: space.md }}>
        {res.loading ? <LoadingList /> : res.error ? <ErrorState message={res.error} onRetry={res.reload} /> : !res.data?.length ? <Empty icon="flag" title="該当する通報はありません" /> : res.data.map((r) => (
          <Card key={r.id} style={r.category === 'prohibited_service' || r.category === 'underage' ? { borderColor: colors.danger } : undefined}>
            <Row style={{ justifyContent: 'space-between' }} wrap>
              <T v="h3">{CAT[r.category] ?? r.category}</T>
              {STATUS_PILL(r.status)}
            </Row>
            <T v="small" style={{ marginTop: 4 }}>
              通報者 {r.reporter.display_name}（{ROLE_LABEL[r.reporter.role]}）→ 対象 {r.target.display_name}（{ROLE_LABEL[r.target.role]}・{r.target.status}）・ {relative(r.created_at)}
            </T>
            {r.detail ? <T v="body" style={{ marginTop: space.sm }}>{r.detail}</T> : null}
            {r.message ? <View style={{ marginTop: space.sm, padding: space.md, backgroundColor: colors.bg, borderRadius: 10 }}><T v="small">対象メッセージ</T><T v="body">{r.message}</T></View> : null}
            {r.admin_note ? <T v="small" style={{ marginTop: space.sm }}>運営メモ：{r.admin_note}</T> : null}
            <Row gap={space.sm} style={{ marginTop: space.md }} wrap>
              <Button small variant="quiet" title="確認中にする" onPress={() => update(r.id, 'reviewing')} />
              <Button small variant="danger" title="対応済み＋相手を停止" onPress={() => update(r.id, 'actioned', true)} testID={`report-suspend-${r.id}`} />
              <Button small title="対応済み" onPress={() => update(r.id, 'actioned')} />
              <Button small variant="ghost" title="対象外" onPress={() => update(r.id, 'dismissed')} />
              <Button small variant="ghost" title="対象ユーザー" onPress={() => router.push(`/admin/user/${r.target.id}`)} />
            </Row>
          </Card>
        ))}
      </View>
    </AdminPage>
  );
}
