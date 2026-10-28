import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { Badges, TopBar } from '@/components/blocks';
import type { IconName } from '@/components/Icon';
import { Avatar, Card, Divider, ListGroup, ListRow, Pill, RankBadge, Row, Screen, Section, T, useConfirm } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { space } from '@/theme/tokens';

const VERIFY_LABEL = { unsubmitted: '本人確認 未提出', pending: '本人確認 審査中', approved: '本人確認済み', rejected: '本人確認 要再提出' } as const;

type Item = { icon: IconName; title: string; subtitle?: string; href: Href; testID?: string };

export function MyPage() {
  const { me, signOut, refreshMe } = useAuth();
  const confirm = useConfirm();
  useFocusEffect(useCallback(() => { refreshMe(); }, [refreshMe]));
  if (!me) return null;
  const isWoman = me.role === 'woman';
  const level = isWoman ? me.woman?.level : me.man?.level;
  const rank = isWoman ? me.woman?.rank_code : me.access?.unlocked_rank;

  const main: Item[] = isWoman
    ? [
        { icon: 'user', title: 'プロフィール編集', subtitle: '写真・自己紹介・所属店舗・公開設定', href: '/profile', testID: 'menu-profile' },
        { icon: 'settings', title: '受付モード・受付条件', subtitle: me.woman?.accept_mode === 'open' ? '幅広く受け付ける' : '自分で選ぶ', href: '/accept-settings', testID: 'menu-accept' },
        { icon: 'yen', title: '報酬・履歴', subtitle: 'アプリ内の確定報酬（デモ）', href: '/earnings', testID: 'menu-earnings' },
        { icon: 'qr', title: '紹介用リンク・QR', subtitle: '既存のお客様をプロフィールへ招待', href: '/share', testID: 'menu-share' },
      ]
    : [
        { icon: 'user', title: 'プロフィール編集', href: '/profile', testID: 'menu-profile' },
        { icon: 'crown', title: '会員プラン・ランク', subtitle: `${me.access?.plan_code ?? 'FREE'} ／ ${me.access?.unlocked_rank ?? 'C'}ランクまで申し込み可`, href: '/membership', testID: 'menu-membership' },
      ];
  const common: Item[] = [
    { icon: 'shield', title: '本人確認', subtitle: VERIFY_LABEL[me.verification.status], href: '/verification', testID: 'menu-verification' },
    { icon: 'bell', title: '通知センター', href: '/notifications' },
    { icon: 'block', title: '安全設定・ブロック一覧', href: '/safety', testID: 'menu-safety' },
    { icon: 'mail', title: '問い合わせ・異議申立て', href: '/support', testID: 'menu-support' },
    { icon: 'settings', title: '設定', subtitle: 'パスワード変更・規約・退会', href: '/settings', testID: 'menu-settings' },
  ];

  return (
    <>
      <TopBar title="マイページ" />
      <Screen>
        <Card style={{ marginTop: space.sm }}>
          <Row gap={space.lg}>
            <Avatar path={me.photos[0]} size={68} />
            <View style={{ flex: 1, gap: 4 }}>
              <T v="h2">{me.display_name}</T>
              <Row gap={6} wrap>
                <Pill label={VERIFY_LABEL[me.verification.status]} tone={me.verification.status === 'approved' ? 'success' : 'gold'} icon="shield" />
                <Pill label={`Lv.${level ?? 1}`} />
                {isWoman ? <Pill label={me.woman?.is_published ? '公開中' : '非公開'} tone={me.woman?.is_published ? 'gold' : 'neutral'} /> : null}
              </Row>
            </View>
            {rank ? <View style={{ alignItems: 'center' }}><RankBadge code={rank} size="lg" /><T v="small" style={{ marginTop: 2 }}>{isWoman ? '現在ランク' : '申込可能'}</T></View> : null}
          </Row>
          {me.badges?.length ? <View style={{ marginTop: space.lg }}><Badges badges={me.badges} /></View> : null}
        </Card>

        <Section title="MENU">
          <ListGroup>
            {main.map((m, i) => (
              <View key={m.title}>{i > 0 ? <Divider style={{ marginLeft: 64 }} /> : null}<ListRow testID={m.testID} icon={m.icon} title={m.title} subtitle={m.subtitle} onPress={() => router.push(m.href)} /></View>
            ))}
          </ListGroup>
        </Section>
        <Section title="ACCOUNT">
          <ListGroup>
            {common.map((m, i) => (
              <View key={m.title}>{i > 0 ? <Divider style={{ marginLeft: 64 }} /> : null}<ListRow testID={m.testID} icon={m.icon} title={m.title} subtitle={m.subtitle} onPress={() => router.push(m.href)} /></View>
            ))}
            <Divider style={{ marginLeft: 64 }} />
            <ListRow
              testID="menu-logout"
              icon="logout"
              title="ログアウト"
              danger
              onPress={async () => {
                const r = await confirm({ title: 'ログアウトしますか？', confirm: 'ログアウト' });
                if (r.ok) {
                  await signOut();
                  router.replace('/');
                }
              }}
            />
          </ListGroup>
        </Section>
      </Screen>
    </>
  );
}
