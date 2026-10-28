import { Link, Redirect, router } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { Icon, type IconName } from '@/components/Icon';
import { Button, Gap, Pill, Row, Screen, T } from '@/components/ui';
import { useAuth, useServiceName } from '@/lib/auth';
import { homeFor } from '@/lib/nav';
import { colors, space } from '@/theme/tokens';

export default function Landing() {
  const { session, me } = useAuth();
  const name = useServiceName();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  if (session && me) {
    if (me.status !== 'active') return <Redirect href="/account-status" />;
    return <Redirect href={homeFor(me.role)} />;
  }
  const wide = width >= 760;
  return (
    <Screen padded>
      <View style={{ paddingTop: insets.top + space.xl }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="caption">MEMBERS ONLY</T>
          <Pill label="開発版・デモ" tone="gold" />
        </Row>
        <View style={[styles.hero, wide && { flexDirection: 'row', alignItems: 'center' }]}>
          <View style={{ flex: 1, gap: space.lg }}>
            <T v="brand" style={{ fontSize: wide ? 44 : 36, letterSpacing: 8 }}>{name}</T>
            <View style={styles.rule} />
            <T v="display" style={{ fontSize: wide ? 30 : 25, lineHeight: wide ? 44 : 38 }}>会員制ラウンジのように、{'\n'}静かで上質なひとときを。</T>
            <T v="sub" style={{ fontSize: 15, lineHeight: 25 }}>
              会話や食事など、一緒に過ごす時間に価値を感じる方と、その時間を大切にする女性をつなぐ会員制サービスです。予約は女性が一件ずつ承認して初めて成立します。
            </T>
          </View>
          <View style={[styles.art, wide && { width: 320, height: 320, marginLeft: space.xxl }]}>
            <HeroArt />
          </View>
        </View>

        <View style={{ gap: space.md, marginTop: space.xl }}>
          <Button title="はじめる" variant="primary" onPress={() => router.push('/auth/role')} testID="cta-start" />
          <Button title="ログイン" variant="outline" onPress={() => router.push('/auth/sign-in')} testID="cta-login" />
        </View>

        <View style={[styles.points, wide && { flexDirection: 'row' }]}>
          <Point icon="shield" title="20歳以上・本人確認済み" text="申し込み・予約は本人確認（年齢確認）が完了した会員のみ利用できます。" />
          <Point icon="check" title="女性の承認で成立" text="「幅広く受け付ける」設定でも自動では確定しません。いつでも辞退・ブロック・通報できます。" />
          <Point icon="block" title="性的サービスは一切禁止" text="提供するのは同席・交流の機会のみです。禁止行為は通報・審査・停止の対象です。" />
        </View>

        <View style={styles.links}>
          <Link href="/legal/terms" style={styles.link}>利用規約</Link>
          <Link href="/legal/privacy" style={styles.link}>プライバシーポリシー</Link>
          <Link href="/legal/pricing" style={styles.link}>料金について</Link>
          <Link href="/legal/guidelines" style={styles.link}>禁止事項・安全ガイド</Link>
        </View>
        <T v="small" center style={{ marginTop: space.lg }}>
          サービス名・料金・ランク境界はすべて仮設定です。本番公開前に法令確認・各種審査を行います。
        </T>
        <Gap h={space.xl} />
      </View>
    </Screen>
  );
}

function Point({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={styles.point}>
      <View style={styles.pointIcon}><Icon name={icon} size={18} color={colors.goldDeep} /></View>
      <View style={{ flex: 1 }}>
        <T v="h3">{title}</T>
        <T v="sub">{text}</T>
      </View>
    </View>
  );
}

function HeroArt() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 320">
      <Defs>
        <LinearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.goldLight} />
          <Stop offset="1" stopColor={colors.goldDeep} />
        </LinearGradient>
      </Defs>
      <Circle cx="160" cy="160" r="128" stroke="url(#hg)" strokeWidth="1" fill="none" />
      <Circle cx="160" cy="160" r="96" stroke={colors.border} strokeWidth="1" fill="none" />
      <Path d="M78 214 C 112 150, 150 118, 160 72 C 170 118, 208 150, 242 214" stroke="url(#hg)" strokeWidth="1.2" fill="none" />
      <Path d="M108 236 C 132 206, 148 196, 160 168 C 172 196, 188 206, 212 236" stroke="url(#hg)" strokeWidth="1" fill="none" opacity="0.7" />
      <Circle cx="160" cy="72" r="3" fill={colors.gold} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: space.xxl, gap: space.xl },
  rule: { width: 48, height: 1, backgroundColor: colors.gold },
  art: { height: 220, alignSelf: 'center', width: 220 },
  points: { marginTop: space.xxl, gap: space.lg },
  point: { flex: 1, flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  pointIcon: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.goldLight, alignItems: 'center', justifyContent: 'center' },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.lg, marginTop: space.xxl, paddingTop: space.xl, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  link: { color: colors.sub, fontSize: 13, textDecorationLine: 'underline', paddingVertical: 6 },
});
