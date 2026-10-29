import { Image } from 'expo-image';
import { Link, Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DemoStatus } from '@/components/DemoStatus';
import { Icon, type IconName } from '@/components/Icon';
import { Button, Pill, RankBadge, Row, Screen, T } from '@/components/ui';
import { useAuth, useServiceName } from '@/lib/auth';
import { DEMO_BROWSER } from '@/lib/supabase';
import { homeFor } from '@/lib/nav';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

// デモ画像（AI 生成。実在人物の写真ではない）
const SAMPLE = [
  require('../../assets/images/demo/w1-1.svg'),
  require('../../assets/images/demo/w2-1.svg'),
  require('../../assets/images/demo/w4-1.svg'),
];

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
    <Screen padded wide>
      <View style={{ paddingTop: insets.top + space.lg }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="brand" style={styles.logo}>{name}</T>
          <Pill label="開発版・デモ" tone="gold" />
        </Row>

        <View style={[styles.hero, wide && { flexDirection: 'row', alignItems: 'center', gap: space.xxxl }]}>
          <View style={{ flex: 1, gap: space.md, minWidth: wide ? 420 : undefined }}>
            <T v="caption">PRIVATE MEMBERS CLUB</T>
            <T v="display" style={[styles.headline, wide && { fontSize: 36, lineHeight: 50 }]}>上質な会話と、{'\n'}特別な時間を。</T>
            <T v="sub" style={styles.lead}>本人確認済みの会員同士で、お食事やお茶の時間を予約できる会員制サービスです。</T>
            <View style={[styles.ctas, wide && { flexDirection: 'row' }]}>
              <Button title="はじめる" onPress={() => router.push('/auth/role')} testID="cta-start" style={wide ? { flex: 1 } : undefined} />
              <Button title="ログイン" variant="outline" onPress={() => router.push('/auth/sign-in')} testID="cta-login" style={wide ? { flex: 1 } : undefined} />
            </View>
            {DEMO_BROWSER || __DEV__ ? <QuickDemo /> : null}
            <DemoStatus compact />
          </View>
          <Showcase wide={wide} />
        </View>

        <View style={[styles.trust, wide && { flexDirection: 'row' }]}>
          <Trust icon="shield" title="20歳以上・本人確認制" text="申し込みと予約は、年齢と本人の確認が済んだ会員だけが行えます。" />
          <Trust icon="check" title="成立は女性の承認で" text="受付設定にかかわらず、予約は女性が1件ずつ承認して確定します。" />
          <Trust icon="block" title="同席・交流のみ" text="性的サービスの売買は禁止です。通報・審査・停止の仕組みがあります。" />
        </View>

        <View style={styles.links}>
          <Link href="/legal/terms" style={styles.link}>利用規約</Link>
          <Link href="/legal/privacy" style={styles.link}>プライバシー</Link>
          <Link href="/legal/pricing" style={styles.link}>料金</Link>
          <Link href="/legal/guidelines" style={styles.link}>禁止事項・安全</Link>
        </View>
        <T v="small" center style={{ marginBottom: space.xl }}>名称・料金・ランク条件は仮設定です。人物画像は AI 生成のデモ画像で、実在の会員ではありません。</T>
      </View>
    </Screen>
  );
}

/** デモ版のみ：登録なしで、用意したデモアカウントにワンタップで入れる */
function QuickDemo() {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const go = async (email: string) => {
    setBusy(email);
    setErr(null);
    try {
      await signIn(email, 'DemoPass123!');
      router.replace('/');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const list = [
    { label: '男性で試す', email: 'taro@demo.projectgold.local', id: 'quick-man' },
    { label: '女性で試す', email: 'misaki@demo.projectgold.local', id: 'quick-woman' },
    { label: '運営で試す', email: 'admin@demo.projectgold.local', id: 'quick-admin' },
  ];
  return (
    <View style={styles.quick}>
      <T v="h3" style={{ fontSize: 14 }}>登録せずにすぐ試す（デモ）</T>
      <T v="small">押すだけでデモ用アカウントに入れます。</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
        {list.map((d) => (
          <Button key={d.id} small variant="outline" title={d.label} loading={busy === d.email} disabled={!!busy} onPress={() => go(d.email)} testID={d.id} style={{ flexGrow: 1 }} />
        ))}
      </View>
      {err ? <T v="small" color={colors.danger} style={{ marginTop: space.sm }}>{err}</T> : null}
    </View>
  );
}

/** サービスの中身が伝わるよう、女性プロフィールカードの見本を重ねて見せる */
function Showcase({ wide }: { wide: boolean }) {
  const w = wide ? 190 : 128;
  return (
    <View style={[styles.showcase, { height: w * 1.25 + 56 }, wide && { width: w * 2.2 }]} accessibilityLabel="プロフィールカードの見本（デモ画像）">
      {SAMPLE.map((src, i) => (
        <View
          key={i}
          style={[styles.sample, shadow, {
            width: w, top: i === 1 ? 0 : 22, zIndex: i === 1 ? 2 : 1,
            left: wide ? i * w * 0.6 : `${50 - 16 + (i - 1) * 30}%`,
            marginLeft: wide ? 0 : -w * 0.3,
            transform: [{ rotate: `${(i - 1) * 4}deg` }],
          }]}>
          <Image source={src} style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: radius.md }} contentFit="cover" />
          {i === 1 ? (
            <Row style={{ justifyContent: 'space-between', paddingTop: 6, paddingHorizontal: 2 }}>
              <T v="small" style={{ color: colors.text, fontWeight: '600' }}>玲奈・六本木</T>
              <RankBadge code="A" size="sm" />
            </Row>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function Trust({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={styles.trustItem}>
      <View style={styles.trustIcon}><Icon name={icon} size={16} color={colors.goldDeep} /></View>
      <View style={{ flex: 1 }}>
        <T v="h3" style={{ fontSize: 14.5 }}>{title}</T>
        <T v="small">{text}</T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { fontSize: 17, letterSpacing: 4, fontFamily: fonts.serifBold },
  hero: { marginTop: space.xxl, gap: space.xl },
  headline: { fontSize: 30, lineHeight: 42, letterSpacing: 0.5 },
  lead: { fontSize: 15, lineHeight: 24, maxWidth: 440 },
  ctas: { gap: space.sm, marginTop: space.md, maxWidth: 460 },
  quick: { padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.goldLight, backgroundColor: colors.surface, gap: 2, maxWidth: 460 },
  showcase: { position: 'relative', alignSelf: 'center', width: '100%', maxWidth: 420 },
  sample: { position: 'absolute', backgroundColor: colors.surface, borderRadius: radius.lg, padding: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  trust: { marginTop: space.xxl, gap: space.md },
  trustItem: { flex: 1, flexDirection: 'row', gap: space.md, alignItems: 'flex-start', padding: space.md, borderRadius: radius.md, backgroundColor: colors.goldWash },
  trustIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.lg, marginTop: space.xl, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  link: { color: colors.sub, fontSize: 13, textDecorationLine: 'underline', paddingVertical: 8 },
});
