import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Divider, ErrorState, Field, LoadingList, Photo, Pill, RankBadge, Row, Section, T, useConfirm, useToast } from '@/components/ui';
import { call, toMessage, useRpc } from '@/lib/api';
import { dateLabel, timeLabel, yen } from '@/lib/format';
import { AdminPage, KV, ROLE_LABEL, STATUS_PILL } from '@/screens/AdminKit';
import { space } from '@/theme/tokens';

type Detail = {
  profile: { id: string; role: string; display_name: string; area: string; status: string; status_reason: string | null; created_at: string };
  email: string;
  verification: { status: string; method: string; birth_year: number | null; submitted_at: string | null; rejection_reason: string | null } | null;
  woman: { headline: string; bio: string; rank_code: string; rank_score: number; review_score: number; review_note: string; is_published: boolean; accept_mode: string; level: number; xp: number } | null;
  man: { spend_total: number; spend_rank_code: string; level: number; xp: number } | null;
  access: { unlocked_rank: string; plan_code: string; source: string } | null;
  venue: { id: string; venue_name: string; area: string; is_public: boolean; verify_status: string } | null;
  photos: { id: string; path: string; status: string }[];
  rank_snapshots: { id: number; rank_code: string; score: number; reason: string; computed_at: string; breakdown: Record<string, unknown> }[];
  reports_against: { id: string; category: string; status: string; created_at: string }[];
  bookings: Record<string, number> | null;
  earnings_net: number | null;
  entitlement: { plan_code: string; current_period_end: string } | null;
};

export default function AdminUser() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const res = useRpc<Detail>('admin_get_user', { p_id: id });
  const toast = useToast();
  const confirm = useConfirm();
  const [credit, setCredit] = useState('50000');
  const d = res.data;

  const run = async (fn: string, args: Record<string, unknown>, msg: string) => {
    try {
      res.setData(await call<Detail>(fn, args));
      toast(msg);
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };

  return (
    <AdminPage title={d?.profile.display_name ?? 'ユーザー'} subtitle={d ? `${ROLE_LABEL[d.profile.role]} ・ ${d.email}` : undefined}
      action={<Button small variant="ghost" title="← 一覧へ" onPress={() => (router.canGoBack() ? router.back() : router.replace('/admin/users'))} />}>
      {res.loading ? <LoadingList /> : res.error || !d ? <ErrorState message={res.error ?? ''} onRetry={res.reload} /> : (
        <View style={{ gap: space.md }}>
          <Card>
            <KV k="状態" v={STATUS_PILL(d.profile.status)} />
            {d.profile.status_reason ? <KV k="理由" v={d.profile.status_reason} /> : null}
            <KV k="登録日" v={dateLabel(d.profile.created_at)} />
            <KV k="エリア" v={d.profile.area || '—'} />
            <Row gap={space.sm} style={{ marginTop: space.md }} wrap>
              {d.profile.status === 'active' && d.profile.role !== 'admin' ? (
                <Button small variant="danger" title="利用停止" onPress={async () => {
                  const r = await confirm({ title: '利用停止にしますか？', message: '本人には理由と異議申立ての案内が表示されます。', confirm: '停止する', danger: true, input: { label: '停止理由（本人に表示）', required: true } });
                  if (r.ok) run('admin_set_user_status', { p_user: id, p_status: 'suspended', p_reason: r.text }, '停止しました');
                }} testID="admin-suspend" />
              ) : null}
              {d.profile.status === 'suspended' ? <Button small title="停止を解除" onPress={() => run('admin_set_user_status', { p_user: id, p_status: 'active', p_reason: null }, '解除しました')} /> : null}
              {d.profile.status === 'deletion_requested' ? <Button small variant="danger" title="退会処理（匿名化）" onPress={async () => {
                const r = await confirm({ title: '退会処理を実行しますか？', confirm: '実行する', danger: true });
                if (r.ok) { await call('admin_process_deletion', { p_user: id }); toast('退会処理を完了しました'); res.reload(); }
              }} /> : null}
            </Row>
          </Card>

          <Section title="VERIFICATION ・ 本人確認">
            <Card>
              <KV k="状態" v={STATUS_PILL(d.verification?.status ?? 'unsubmitted')} />
              <KV k="方式" v={d.verification?.method ?? '—'} />
              <KV k="生年" v={d.verification?.birth_year ?? '—'} />
              <Row gap={space.sm} style={{ marginTop: space.md }}>
                <Button small title="承認" onPress={() => run('admin_set_verification', { p_user: id, p_status: 'approved', p_reason: null }, '承認しました')} />
                <Button small variant="quiet" title="却下" onPress={async () => {
                  const r = await confirm({ title: '却下しますか？', confirm: '却下', danger: true, input: { label: '理由', required: true } });
                  if (r.ok) run('admin_set_verification', { p_user: id, p_status: 'rejected', p_reason: r.text }, '却下しました');
                }} />
              </Row>
            </Card>
          </Section>

          {d.woman ? (
            <Section title="WOMAN ・ ランク・キュレーション（非公開）">
              <Card>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View><T v="h3">{d.woman.rank_code}ランク（スコア {Number(d.woman.rank_score).toFixed(1)}）</T><T v="small">Lv.{d.woman.level} ・ {d.woman.is_published ? '公開中' : '非公開'} ・ {d.woman.accept_mode === 'open' ? '幅広く' : '自分で選ぶ'}</T></View>
                  <RankBadge code={d.woman.rank_code} size="lg" />
                </Row>
                <KV k="確定報酬（純額）" v={yen(d.earnings_net ?? 0)} />
                <Divider style={{ marginVertical: space.md }} />
                <ReviewEditor key={`${d.woman.review_score}|${d.woman.review_note}`} score={d.woman.review_score} note={d.woman.review_note}
                  onSave={(score, note) => run('admin_set_review', { p_woman: id, p_score: score, p_note: note }, '再計算しました')} />
              </Card>
              {d.venue ? (
                <Card style={{ marginTop: space.md }}>
                  <KV k="所属店舗" v={`${d.venue.venue_name}（${d.venue.area}）`} />
                  <KV k="表示希望" v={d.venue.is_public ? 'あり' : 'なし'} />
                  <KV k="確認状況" v={STATUS_PILL(d.venue.verify_status)} />
                  <Row gap={space.sm} style={{ marginTop: space.sm }}>
                    <Button small title="確認済み" onPress={() => run('admin_set_venue_status', { p_venue: d.venue!.id, p_status: 'approved' }, '更新しました')} />
                    <Button small variant="quiet" title="確認できない" onPress={() => run('admin_set_venue_status', { p_venue: d.venue!.id, p_status: 'rejected' }, '更新しました')} />
                  </Row>
                </Card>
              ) : null}
            </Section>
          ) : null}

          {d.man ? (
            <Section title="MAN ・ ランク・会員">
              <Card>
                <KV k="確定利用額" v={yen(d.man.spend_total)} />
                <KV k="利用実績ランク" v={d.man.spend_rank_code} />
                <KV k="会員プラン" v={d.entitlement ? `${d.entitlement.plan_code}（〜${dateLabel(d.entitlement.current_period_end)}）` : 'FREE'} />
                <KV k="申し込み可能" v={d.access ? `${d.access.unlocked_rank}ランクまで（${d.access.source === 'plan' ? 'プラン' : '利用実績'}）` : '—'} />
                <KV k="レベル" v={`Lv.${d.man.level}（${d.man.xp}pt）`} />
                <Divider style={{ marginVertical: space.md }} />
                <T v="small" style={{ marginBottom: space.sm }}>開発・デモ用：サンドボックスの利用額を付与します（実決済ではありません）。</T>
                <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}><Field label="付与額（円）" value={credit} onChangeText={(t) => setCredit(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" /></View>
                </Row>
                <Row gap={space.sm} wrap>
                  <Button small variant="outline" title="デモ利用額を付与" onPress={() => run('admin_sandbox_credit_spend', { p_user: id, p_amount: Number(credit), p_note: '管理画面からのデモ付与' }, '付与しました')} testID="admin-credit" />
                  {d.entitlement ? <Button small variant="quiet" title="プランを失効" onPress={() => run('admin_expire_entitlement', { p_user: id }, '失効しました')} /> : null}
                </Row>
              </Card>
            </Section>
          ) : null}

          {d.photos.length ? (
            <Section title="PHOTOS">
              <Row wrap gap={space.md}>
                {d.photos.map((p) => (
                  <View key={p.id} style={{ width: 96, gap: 4 }}>
                    <Photo path={p.path} style={{ width: 96, aspectRatio: 4 / 5 }} />
                    {STATUS_PILL(p.status)}
                    {p.status !== 'rejected' ? <Button small variant="ghost" title="非承認" onPress={async () => { await call('admin_moderate_photo', { p_photo: p.id, p_status: 'rejected' }); res.reload(); }} /> : (
                      <Button small variant="ghost" title="承認" onPress={async () => { await call('admin_moderate_photo', { p_photo: p.id, p_status: 'approved' }); res.reload(); }} />
                    )}
                  </View>
                ))}
              </Row>
            </Section>
          ) : null}

          <Section title="RANK HISTORY ・ 計算根拠（監査用）">
            {!d.rank_snapshots.length ? <T v="sub">履歴なし</T> : (
              <Card padded={false}>
                {d.rank_snapshots.map((s, i) => (
                  <View key={s.id}>
                    {i > 0 ? <Divider /> : null}
                    <View style={{ padding: space.lg }}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <T v="h3">{s.rank_code}（{Number(s.score).toFixed(d.woman ? 1 : 0)}）</T>
                        <T v="small">{dateLabel(s.computed_at)} {timeLabel(s.computed_at)} ・ {s.reason}</T>
                      </Row>
                      <T v="small" selectable>{JSON.stringify(s.breakdown).slice(0, 400)}</T>
                    </View>
                  </View>
                ))}
              </Card>
            )}
          </Section>

          <Section title="REPORTS ・ 被通報">
            {!d.reports_against.length ? <T v="sub">なし</T> : (
              <Row wrap gap={6}>{d.reports_against.map((r) => <Pill key={r.id} label={`${r.category} / ${r.status}`} tone={r.status === 'actioned' ? 'danger' : 'neutral'} />)}</Row>
            )}
            <T v="small" style={{ marginTop: space.sm }}>予約: {Object.entries(d.bookings ?? {}).map(([k, v]) => `${k} ${v}`).join(' ・ ') || 'なし'}</T>
          </Section>
        </View>
      )}
    </AdminPage>
  );
}

function ReviewEditor({ score: initialScore, note: initialNote, onSave }: { score: number; note: string; onSave: (score: number, note: string) => Promise<void> }) {
  const [score, setScore] = useState(String(initialScore));
  const [note, setNote] = useState(initialNote);
  return (
    <>
      <T v="small" style={{ marginBottom: space.sm }}>プロフィールの見せ方・完成度に関する運営の非公開評価（0〜100）。容姿の採点や公開投票には使用しないでください。</T>
      <Field label="審査スコア" value={score} onChangeText={(t) => setScore(t.replace(/[^0-9]/g, '').slice(0, 3))} keyboardType="number-pad" />
      <Field label="運営メモ（非公開）" value={note} onChangeText={setNote} multiline />
      <Button small title="スコアを保存して再計算" onPress={() => onSave(Number(score), note)} />
    </>
  );
}
