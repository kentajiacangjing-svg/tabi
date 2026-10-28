import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Card, Divider, Empty, ErrorState, LoadingList, Pill, RankBadge, Row, Segmented, T } from '@/components/ui';
import { useRpc } from '@/lib/api';
import { dateLabel } from '@/lib/format';
import { AdminPage, ROLE_LABEL, STATUS_PILL } from '@/screens/AdminKit';
import { colors, radius, space } from '@/theme/tokens';

type U = { id: string; role: string; display_name: string; area: string; status: string; created_at: string; email: string; verification: string; rank: string | null; level: number | null; is_published: boolean | null };

export default function Users() {
  const [role, setRole] = useState<'' | 'woman' | 'man' | 'admin'>('');
  const [status, setStatus] = useState<'' | 'active' | 'suspended' | 'deletion_requested'>('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => { const t = setTimeout(() => setQuery(q), 300); return () => clearTimeout(t); }, [q]);
  const res = useRpc<U[]>('admin_list_users', { p_role: role || null, p_status: status || null, p_verification: null, p_query: query || null });
  return (
    <AdminPage title="ユーザー" subtitle="認証状況の確認・停止・削除" refreshing={res.refreshing} onRefresh={res.refresh}>
      <TextInput value={q} onChangeText={setQ} placeholder="表示名・メールで検索" placeholderTextColor={colors.faint} accessibilityLabel="ユーザー検索"
        style={{ minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: space.lg, backgroundColor: colors.surface, fontSize: 15, marginBottom: space.md }} />
      <Segmented value={role} onChange={setRole} options={[{ value: '', label: 'すべて' }, { value: 'woman', label: '女性' }, { value: 'man', label: '男性' }, { value: 'admin', label: '運営' }]} />
      <View style={{ height: space.sm }} />
      <Segmented value={status} onChange={setStatus} options={[{ value: '', label: '全状態' }, { value: 'active', label: '有効' }, { value: 'suspended', label: '停止中' }, { value: 'deletion_requested', label: '退会申請' }]} />
      <View style={{ marginTop: space.lg }}>
        {res.loading ? <LoadingList /> : res.error ? <ErrorState message={res.error} onRetry={res.reload} /> : !res.data?.length ? <Empty icon="users" title="該当するユーザーはいません" /> : (
          <Card padded={false}>
            {res.data.map((u, i) => (
              <View key={u.id}>
                {i > 0 ? <Divider /> : null}
                <Pressable onPress={() => router.push(`/admin/user/${u.id}`)} style={({ pressed }) => [{ padding: space.lg }, pressed && { backgroundColor: colors.bg }]} accessibilityRole="button" testID={`admin-user-${u.email.split('@')[0]}`}>
                  <Row style={{ justifyContent: 'space-between' }} gap={space.md}>
                    <Row gap={space.md} style={{ flex: 1 }}>
                      {u.rank ? <RankBadge code={u.rank} size="sm" /> : <View style={{ width: 26 }} />}
                      <View style={{ flex: 1 }}>
                        <T v="h3" numberOfLines={1}>{u.display_name} <T v="small">（{ROLE_LABEL[u.role]}）</T></T>
                        <T v="small" numberOfLines={1}>{u.email} ・ {dateLabel(u.created_at)}登録{u.level ? ` ・ Lv.${u.level}` : ''}</T>
                      </View>
                    </Row>
                    <Row gap={6} wrap style={{ justifyContent: 'flex-end' }}>
                      {STATUS_PILL(u.status)}
                      {u.verification ? <Pill label={`本人確認:${{ approved: '済', pending: '審査中', rejected: '却下', unsubmitted: '未' }[u.verification] ?? u.verification}`} tone={u.verification === 'approved' ? 'success' : 'neutral'} /> : null}
                      {u.role === 'woman' ? <Pill label={u.is_published ? '公開' : '非公開'} /> : null}
                    </Row>
                  </Row>
                </Pressable>
              </View>
            ))}
          </Card>
        )}
      </View>
    </AdminPage>
  );
}
