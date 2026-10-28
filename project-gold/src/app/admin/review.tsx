import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Empty, ErrorState, LoadingList, Photo, Pill, Row, Segmented, T, useConfirm, useToast } from '@/components/ui';
import { call, toMessage, useRpc } from '@/lib/api';
import { relative } from '@/lib/format';
import { AdminPage, ROLE_LABEL } from '@/screens/AdminKit';
import { space } from '@/theme/tokens';

type Queue = {
  verifications: { user_id: string; display_name: string; role: string; birth_year: number | null; method: string; submitted_at: string }[];
  venues: { id: string; woman_id: string; display_name: string; venue_name: string; area: string; is_public: boolean; created_at: string }[];
  photos: { id: string; user_id: string; display_name: string; path: string; created_at: string }[];
  deletions: { user_id: string; display_name: string; role: string; updated_at: string }[];
};
type Tab = 'verifications' | 'venues' | 'photos' | 'deletions';

export default function Review() {
  const q = useRpc<Queue>('admin_review_queue');
  const [tab, setTab] = useState<Tab>('verifications');
  const toast = useToast();
  const confirm = useConfirm();
  const x = q.data;
  const run = async (fn: string, args: Record<string, unknown>, msg: string) => {
    try {
      await call(fn, args);
      toast(msg);
      q.reload();
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  const count = (t: Tab) => (x ? x[t].length : 0);
  return (
    <AdminPage title="登録審査" subtitle="本人確認・所属店舗・写真・退会の処理" refreshing={q.refreshing} onRefresh={q.refresh}>
      <Segmented value={tab} onChange={setTab} options={[
        { value: 'verifications', label: `本人確認 ${count('verifications')}` },
        { value: 'venues', label: `店舗 ${count('venues')}` },
        { value: 'photos', label: `写真 ${count('photos')}` },
        { value: 'deletions', label: `退会 ${count('deletions')}` },
      ]} />
      <View style={{ marginTop: space.lg, gap: space.md }}>
        {q.loading ? <LoadingList /> : q.error || !x ? <ErrorState message={q.error ?? ''} onRetry={q.reload} /> : x[tab].length === 0 ? <Empty icon="check" title="対応待ちはありません" /> : (
          <>
            {tab === 'verifications' && x.verifications.map((v) => (
              <Card key={v.user_id}>
                <Row style={{ justifyContent: 'space-between' }} wrap>
                  <View>
                    <T v="h3">{v.display_name}</T>
                    <T v="small">{ROLE_LABEL[v.role]} ・ 生年 {v.birth_year ?? '—'} ・ 方式 {v.method} ・ {relative(v.submitted_at)}</T>
                  </View>
                  <Row gap={space.sm}>
                    <Button small title="承認" onPress={() => run('admin_set_verification', { p_user: v.user_id, p_status: 'approved', p_reason: null }, '承認しました')} testID={`verify-approve-${v.user_id}`} />
                    <Button small variant="quiet" title="却下" onPress={async () => {
                      const r = await confirm({ title: '本人確認を却下しますか？', confirm: '却下する', danger: true, input: { label: '本人に表示する理由', required: true } });
                      if (r.ok) run('admin_set_verification', { p_user: v.user_id, p_status: 'rejected', p_reason: r.text }, '却下しました');
                    }} />
                    <Button small variant="ghost" title="詳細" onPress={() => router.push(`/admin/user/${v.user_id}`)} />
                  </Row>
                </Row>
              </Card>
            ))}
            {tab === 'venues' && x.venues.map((v) => (
              <Card key={v.id}>
                <Row style={{ justifyContent: 'space-between' }} wrap>
                  <View>
                    <T v="h3">{v.venue_name}（{v.area}）</T>
                    <T v="small">{v.display_name} ・ {v.is_public ? '公開希望' : '非公開'} ・ {relative(v.created_at)}</T>
                    <T v="small">在籍確認は店舗への照会など、確認可能な方法でのみ行ってください。売上情報は取得しません。</T>
                  </View>
                  <Row gap={space.sm}>
                    <Button small title="確認済み" onPress={() => run('admin_set_venue_status', { p_venue: v.id, p_status: 'approved' }, '確認済みにしました')} />
                    <Button small variant="quiet" title="確認できない" onPress={() => run('admin_set_venue_status', { p_venue: v.id, p_status: 'rejected' }, '更新しました')} />
                  </Row>
                </Row>
              </Card>
            ))}
            {tab === 'photos' && x.photos.map((p) => (
              <Card key={p.id}>
                <Row gap={space.lg}>
                  <Photo path={p.path} style={{ width: 96, aspectRatio: 4 / 5 }} />
                  <View style={{ flex: 1, gap: space.sm }}>
                    <T v="h3">{p.display_name}</T>
                    <T v="small">{relative(p.created_at)}</T>
                    <Row gap={space.sm}>
                      <Button small title="承認" onPress={() => run('admin_moderate_photo', { p_photo: p.id, p_status: 'approved' }, '承認しました')} />
                      <Button small variant="quiet" title="非承認" onPress={() => run('admin_moderate_photo', { p_photo: p.id, p_status: 'rejected' }, '非承認にしました')} />
                    </Row>
                  </View>
                </Row>
              </Card>
            ))}
            {tab === 'deletions' && x.deletions.map((d) => (
              <Card key={d.user_id}>
                <Row style={{ justifyContent: 'space-between' }} wrap>
                  <View><T v="h3">{d.display_name}</T><T v="small">{ROLE_LABEL[d.role]} ・ {relative(d.updated_at)}に申請</T></View>
                  <Row gap={space.sm}>
                    <Pill label="退会申請" tone="gold" />
                    <Button small variant="danger" title="匿名化して退会処理" onPress={async () => {
                      const r = await confirm({ title: '退会処理を実行しますか？', message: '表示名・写真・自己紹介・メッセージ本文・メールアドレスを削除/匿名化します。取引記録は匿名状態で保持します。', confirm: '実行する', danger: true });
                      if (r.ok) run('admin_process_deletion', { p_user: d.user_id }, '退会処理を完了しました');
                    }} />
                  </Row>
                </Row>
              </Card>
            ))}
          </>
        )}
      </View>
    </AdminPage>
  );
}
