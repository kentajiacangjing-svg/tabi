import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { colors, fonts } from '@/theme/tokens';

export type TabDef = { name: string; title: string; icon: IconName; badge?: number };

/** 白地に細い金のインジケーター。iOS/Android/Web で同じ見た目にするため JS タブを使用 */
export function RoleTabs({ tabs }: { tabs: TabDef[] }) {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      tabBar={(props) => <Bar {...props} tabs={tabs} />}>
      {tabs.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title }} />
      ))}
    </Tabs>
  );
}

function Bar({ state, emitter, navigateToTab, tabs }: BottomTabBarProps & { tabs: TabDef[] }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 10 : 8) }]} accessibilityRole="tablist">
      <View style={styles.row}>
        {state.routes.map((route, i) => {
          const def = tabs.find((t) => t.name === route.name);
          if (!def) return null;
          const focused = state.index === i;
          return (
            <Pressable
              key={route.key}
              testID={`tab-${route.name}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={def.title}
              onPress={() => {
                const e = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) navigateToTab(route.key);
              }}
              style={styles.item}>
              <View style={[styles.indicator, focused && { backgroundColor: colors.gold }]} />
              <View>
                <Icon name={def.icon} size={23} color={focused ? colors.goldDeep : colors.faint} strokeWidth={focused ? 1.7 : 1.5} />
                {def.badge ? <View style={styles.badge}><Text style={styles.badgeText}>{def.badge > 9 ? '9+' : def.badge}</Text></View> : null}
              </View>
              <Text style={[styles.label, focused && { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>{def.title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  row: { flexDirection: 'row', maxWidth: 720, width: '100%', alignSelf: 'center' },
  item: { flex: 1, alignItems: 'center', paddingTop: 0, minHeight: 54, gap: 3 },
  indicator: { width: 22, height: 2, borderRadius: 1, marginBottom: 6, backgroundColor: 'transparent' },
  label: { fontSize: 10.5, color: colors.faint, letterSpacing: 0.3, fontFamily: fonts.sans },
  badge: { position: 'absolute', top: -4, right: -9, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9.5, fontWeight: '700' },
});
