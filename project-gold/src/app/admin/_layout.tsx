import { router, Slot, usePathname, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { Pill, T, useConfirm } from '@/components/ui';
import { useAuth, useServiceName } from '@/lib/auth';
import { colors, fonts, space } from '@/theme/tokens';

const NAV: { href: Href; path: string; label: string; icon: IconName }[] = [
  { href: '/admin', path: '/admin', label: 'ダッシュボード', icon: 'chart' },
  { href: '/admin/review', path: '/admin/review', label: '登録審査', icon: 'shield' },
  { href: '/admin/users', path: '/admin/users', label: 'ユーザー', icon: 'users' },
  { href: '/admin/bookings', path: '/admin/bookings', label: '予約・申立て', icon: 'calendar' },
  { href: '/admin/reports', path: '/admin/reports', label: '通報', icon: 'flag' },
  { href: '/admin/refunds', path: '/admin/refunds', label: '返金', icon: 'refresh' },
  { href: '/admin/inquiries', path: '/admin/inquiries', label: '問い合わせ', icon: 'mail' },
  { href: '/admin/config', path: '/admin/config', label: 'プラン・ランク・設定', icon: 'settings' },
  { href: '/admin/payments', path: '/admin/payments', label: '決済連携', icon: 'card' },
  { href: '/admin/audit', path: '/admin/audit', label: '監査ログ', icon: 'list' },
];

export default function AdminLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const { signOut, me } = useAuth();
  const confirm = useConfirm();
  const name = useServiceName();
  const wide = width >= 960;
  const active = (p: string) => (p === '/admin' ? path === '/admin' : path.startsWith(p));
  const logout = async () => {
    const r = await confirm({ title: 'ログアウトしますか？', confirm: 'ログアウト' });
    if (r.ok) {
      await signOut();
      router.replace('/');
    }
  };

  if (wide) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
        <View style={[styles.side, { paddingTop: insets.top + space.xl }]}>
          <T v="brand" style={{ fontSize: 16, letterSpacing: 3 }}>{name}</T>
          <T v="caption" style={{ marginTop: 4, marginBottom: space.xl }}>ADMIN CONSOLE</T>
          {NAV.map((n) => (
            <Pressable key={n.path} onPress={() => router.navigate(n.href)} style={[styles.sideItem, active(n.path) && styles.sideOn]} accessibilityRole="link" testID={`admin-nav-${n.path.split('/').pop()}`}>
              <Icon name={n.icon} size={18} color={active(n.path) ? colors.goldDeep : colors.sub} />
              <Text style={[styles.sideText, active(n.path) && { color: colors.text, fontWeight: '600' }]}>{n.label}</Text>
            </Pressable>
          ))}
          <View style={{ flex: 1 }} />
          <Pill label="内部デモ環境" tone="gold" />
          <T v="small" style={{ marginTop: space.sm }}>{me?.display_name}</T>
          <Pressable onPress={logout} style={[styles.sideItem, { paddingHorizontal: 0 }]} accessibilityRole="button"><Icon name="logout" size={18} color={colors.sub} /><Text style={styles.sideText}>ログアウト</Text></Pressable>
        </View>
        <View style={{ flex: 1 }}><Slot /></View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + space.sm, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
        <View style={styles.topRow}>
          <View>
            <T v="brand" style={{ fontSize: 15, letterSpacing: 3 }}>{name}</T>
            <T v="caption" style={{ fontSize: 10 }}>ADMIN</T>
          </View>
          <Pressable onPress={logout} accessibilityRole="button" accessibilityLabel="ログアウト" style={{ padding: 10 }}><Icon name="logout" size={20} color={colors.sub} /></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.md, gap: 4 }}>
          {NAV.map((n) => (
            <Pressable key={n.path} onPress={() => router.navigate(n.href)} style={[styles.tab, active(n.path) && styles.tabOn]} testID={`admin-nav-${n.path.split('/').pop()}`}>
              <Text style={[styles.tabText, active(n.path) && { color: colors.text, fontWeight: '600' }]}>{n.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <View style={{ flex: 1 }}><Slot /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  side: { width: 248, backgroundColor: colors.surface, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border, paddingHorizontal: space.xl, paddingBottom: space.xl },
  sideItem: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, paddingHorizontal: space.md, borderRadius: 10, marginBottom: 2 },
  sideOn: { backgroundColor: colors.goldWash },
  sideText: { fontSize: 14, color: colors.sub, fontFamily: fonts.sans },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.sm },
  tab: { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.gold },
  tabText: { fontSize: 13.5, color: colors.sub, fontFamily: fonts.sans },
});
