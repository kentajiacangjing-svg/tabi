import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Card, Gap, Header, Notice, Row, Screen, T } from '@/components/ui';
import { colors, space } from '@/theme/tokens';

export default function RoleSelect() {
  return (
    <>
      <Header title="ご利用方法を選択" />
      <Screen>
        <T v="title" style={{ marginTop: space.md }}>どちらで登録しますか？</T>
        <T v="sub" style={{ marginTop: space.xs }}>登録後に役割を変更することはできません。</T>
        <Gap />
        <RoleCard
          testID="role-woman"
          title="女性として登録"
          caption="FOR HOSTS"
          lines={['登録・基本利用は無料', 'お相手は自分で選ぶ／幅広く受け付けるを選択', 'すべての予約はあなたの承認で成立']}
          onPress={() => router.push({ pathname: '/auth/sign-up', params: { role: 'woman' } })}
        />
        <Gap h={space.md} />
        <RoleCard
          testID="role-man"
          title="男性として登録"
          caption="FOR GUESTS"
          lines={['会員プランと利用実績で申し込み可能なランクが広がります', '予約はお相手の承認後に確定', 'プランは申し込み資格であり、成立を保証するものではありません']}
          onPress={() => router.push({ pathname: '/auth/sign-up', params: { role: 'man' } })}
        />
        <Gap />
        <Notice icon="shield" title="20歳以上の方のみご利用いただけます">
          登録後に本人確認（年齢確認）を行います。確認が完了するまで申し込み・予約機能は利用できません。
        </Notice>
      </Screen>
    </>
  );
}

function RoleCard({ title, caption, lines, onPress, testID }: { title: string; caption: string; lines: string[]; onPress: () => void; testID: string }) {
  return (
    <Card onPress={onPress} accessibilityLabel={title}>
      <View testID={testID}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="caption">{caption}</T>
          <Icon name="chevron-right" size={18} color={colors.gold} />
        </Row>
        <T v="h2" style={{ marginTop: space.xs, marginBottom: space.md }}>{title}</T>
        {lines.map((l) => (
          <Row key={l} style={styles.line} gap={space.sm}>
            <Icon name="check" size={15} color={colors.gold} />
            <T v="sub" style={{ flex: 1 }}>{l}</T>
          </Row>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({ line: { alignItems: 'flex-start', marginTop: 4 } });
