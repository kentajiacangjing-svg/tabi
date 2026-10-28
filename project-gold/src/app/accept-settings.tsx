import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Button, Card, Field, Header, Notice, Row, Screen, Section, T, Toggle, useToast } from '@/components/ui';
import { call, toMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AcceptMode, Me } from '@/lib/types';
import { colors, space } from '@/theme/tokens';

export default function AcceptSettings() {
  const { me, setMe } = useAuth();
  const toast = useToast();
  const w = me?.woman;
  const [mode, setMode] = useState<AcceptMode>(w?.accept_mode ?? 'select');
  const [accept, setAccept] = useState(w?.accept_requests ?? true);
  const [minLevel, setMinLevel] = useState(w?.min_man_level ?? 1);
  const [ng, setNg] = useState(w?.ng_note ?? '');
  const save = async () => {
    try {
      setMe(await call<Me>('set_accept_settings', { p_accept_mode: mode, p_accept_requests: accept, p_min_man_level: minLevel, p_ng_note: ng }));
      toast('受付設定を保存しました');
      router.back();
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  return (
    <>
      <Header title="受付モード・受付条件" />
      <Screen footer={<Button title="保存する" onPress={save} testID="accept-save" />}>
        <Section title="MODE ・ 受付モード" style={{ marginTop: space.sm }}>
          <View style={{ gap: space.md }}>
            <ModeCard selected={mode === 'select'} onPress={() => setMode('select')} title="自分で選ぶ" testID="mode-select"
              text="男性からはまず「プロフィール申請」が届きます。あなたが承認した方だけがメッセージ・予約申請できます。招待リンクから参加したお客様も申請できます。" />
            <ModeCard selected={mode === 'open'} onPress={() => setMode('open')} title="幅広く受け付ける" testID="mode-open"
              text="条件を満たす男性は、空き枠へ直接予約申請できます。予約はあなたが一件ずつ承認して初めて確定します（自動確定はしません）。" />
          </View>
        </Section>
        <Section title="CONDITIONS ・ 受付条件">
          <Card>
            <Toggle value={accept} onChange={setAccept} label="新しい申し込みを受け付ける" description="オフにすると、新規のプロフィール申請・予約申請を停止します" />
            <Row style={{ justifyContent: 'space-between', paddingVertical: space.md }}>
              <View style={{ flex: 1 }}>
                <T v="body">男性のレベル条件</T>
                <T v="small">Lv.{minLevel} 以上の方のみ申し込み可能（招待したお客様は対象外）</T>
              </View>
              <Row gap={space.sm}>
                <Step label="下げる" icon="chevron-left" onPress={() => setMinLevel(Math.max(1, minLevel - 1))} />
                <T v="num" style={{ fontSize: 22, minWidth: 28, textAlign: 'center' }}>{minLevel}</T>
                <Step label="上げる" icon="chevron-right" onPress={() => setMinLevel(Math.min(50, minLevel + 1))} />
              </Row>
            </Row>
          </Card>
        </Section>
        <Section title="NG ・ 自分用メモ（非公開）">
          <Field label="NG条件メモ" value={ng} onChangeText={setNg} multiline maxLength={500} placeholder="例：深夜帯はお断り、初回はカフェのみ など" hint="このメモはあなたと運営のみが閲覧できます" />
        </Section>
        <Notice icon="shield" tone="neutral" action={<Button small variant="quiet" title="ブロック一覧" onPress={() => router.push('/safety')} />}>
          不快に感じたお相手は、プロフィール・メッセージ・予約画面からいつでもブロック・通報できます。
        </Notice>
      </Screen>
    </>
  );
}

function ModeCard({ selected, onPress, title, text, testID }: { selected: boolean; onPress: () => void; title: string; text: string; testID: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} testID={testID}>
      <Card style={{ borderColor: selected ? colors.gold : colors.border, borderWidth: selected ? 1 : undefined }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="h3">{title}</T>
          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: selected ? colors.gold : colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
            {selected ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: colors.gold }} /> : null}
          </View>
        </Row>
        <T v="sub" style={{ marginTop: 4 }}>{text}</T>
      </Card>
    </Pressable>
  );
}

function Step({ label, icon, onPress }: { label: string; icon: 'chevron-left' | 'chevron-right'; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
      <Icon name={icon} size={18} />
    </Pressable>
  );
}
