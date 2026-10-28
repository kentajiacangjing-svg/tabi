import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { Card, Pill, Row, T } from '@/components/ui';
import { colors, space } from '@/theme/tokens';

export function AdminPage({ title, subtitle, children, action, refreshing, onRefresh }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl }} refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.gold} /> : undefined}>
      <View style={{ maxWidth: 1080, width: '100%', alignSelf: 'center' }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: space.lg, alignItems: 'flex-end' }} wrap>
          <View style={{ flexShrink: 1 }}>
            <T v="title">{title}</T>
            {subtitle ? <T v="sub">{subtitle}</T> : null}
          </View>
          {action}
        </Row>
        {children}
      </View>
    </ScrollView>
  );
}

export function KPI({ label, value, note, tone }: { label: string; value: string | number; note?: string; tone?: 'danger' | 'gold' }) {
  return (
    <Card style={{ flexGrow: 1, flexBasis: 200, minWidth: 150 }}>
      <T v="small">{label}</T>
      <T v="num" style={{ fontSize: 28, color: tone === 'danger' && Number(value) > 0 ? colors.danger : colors.text }}>{value}</T>
      {note ? <T v="small">{note}</T> : null}
    </Card>
  );
}

export function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 6, alignItems: 'flex-start' }} gap={space.md}>
      <T v="small" style={{ minWidth: 110 }}>{k}</T>
      {typeof v === 'string' || typeof v === 'number' ? <T v="body" style={{ flex: 1, textAlign: 'right' }} selectable>{String(v)}</T> : <View style={{ flex: 1, alignItems: 'flex-end' }}>{v}</View>}
    </Row>
  );
}

export const ROLE_LABEL: Record<string, string> = { woman: '女性', man: '男性', admin: '運営' };
export const STATUS_PILL = (s: string) => {
  const m: Record<string, [string, 'neutral' | 'gold' | 'success' | 'danger' | 'dark']> = {
    active: ['有効', 'success'], suspended: ['停止中', 'danger'], deletion_requested: ['退会申請', 'gold'], deleted: ['退会済み', 'neutral'],
    approved: ['承認', 'success'], pending: ['審査中', 'gold'], rejected: ['却下', 'danger'], unsubmitted: ['未提出', 'neutral'],
    open: ['未対応', 'danger'], reviewing: ['確認中', 'gold'], actioned: ['対応済み', 'success'], dismissed: ['対象外', 'neutral'],
    requested: ['申請中', 'gold'], processed: ['処理済み', 'success'], answered: ['回答済み', 'success'], closed: ['完了', 'neutral'],
  };
  const [l, t] = m[s] ?? [s, 'neutral'];
  return <Pill label={l} tone={t} />;
};
