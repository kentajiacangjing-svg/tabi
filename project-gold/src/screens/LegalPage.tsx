import { View } from 'react-native';

import { Card, Header, Notice, Screen, T } from '@/components/ui';
import { space } from '@/theme/tokens';

export type LegalSection = { h: string; body: string[] };

export function LegalPage({ title, sections, updated = '2026-10-28' }: { title: string; sections: LegalSection[]; updated?: string }) {
  return (
    <>
      <Header title={title} />
      <Screen>
        <Notice icon="info" title="ドラフト（公開前に専門家の確認が必要です）">
          本ページは開発版の仮の文面です。サービス名・料金・手続きは確定しておらず、公開前に弁護士等の確認を経て改訂します。
        </Notice>
        <T v="small" style={{ marginTop: space.md }}>最終更新：{updated}</T>
        <View style={{ gap: space.md, marginTop: space.md }}>
          {sections.map((s) => (
            <Card key={s.h}>
              <T v="h3" style={{ marginBottom: space.sm }}>{s.h}</T>
              {s.body.map((b, i) => <T key={i} v="sub" style={{ marginBottom: 4 }}>{b}</T>)}
            </Card>
          ))}
        </View>
      </Screen>
    </>
  );
}
