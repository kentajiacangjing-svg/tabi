import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, Field, Gap, Header, Notice, Pill, Row, Screen, Section, T, Toggle, useConfirm, useToast } from '@/components/ui';
import { call, toMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Me } from '@/lib/types';
import { PhotoManager } from '@/screens/PhotoManager';
import { space } from '@/theme/tokens';

const AREAS = ['銀座', '六本木', '新宿', '渋谷', '恵比寿', '表参道', '日本橋', '麻布十番', '赤坂', '池袋', '横浜', '大阪・北新地', '名古屋・錦', '福岡・中洲'];
const PLAN_TYPES = ['食事', 'カフェ', 'バー同席', 'ランチ', '観劇・展示'];

export default function ProfileEdit() {
  const { me } = useAuth();
  if (!me) return null;
  return me.role === 'woman' ? <WomanProfile me={me} /> : <ManProfile me={me} />;
}

function ManProfile({ me }: { me: Me }) {
  const { setMe } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(me.display_name);
  const [area, setArea] = useState(me.area);
  const [bio, setBio] = useState(me.man?.bio ?? '');
  const save = async () => {
    try {
      setMe(await call<Me>('update_my_profile', { p_display_name: name, p_area: area, p_bio: bio }));
      toast('保存しました');
      router.back();
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  return (
    <>
      <Header title="プロフィール編集" />
      <Screen footer={<Button title="保存する" onPress={save} disabled={!name.trim()} testID="profile-save" />}>
        <Section title="PHOTO" style={{ marginTop: space.sm }}><PhotoManager max={1} /></Section>
        <Section title="PROFILE">
          <Field label="表示名" value={name} onChangeText={setName} maxLength={30} testID="profile-name" />
          <Field label="主な利用エリア" value={area} onChangeText={setArea} maxLength={30} placeholder="例：港区" testID="profile-area" />
          <Field label="自己紹介（女性に表示されます）" value={bio} onChangeText={setBio} multiline maxLength={500} hint={`${bio.length}/500`} testID="profile-bio" />
          <Notice tone="neutral" icon="shield">お支払い額・利用額は女性には公開されません。表示されるのは表示名・自己紹介・レベル・本人確認状況・完了回数です。</Notice>
        </Section>
      </Screen>
    </>
  );
}

function WomanProfile({ me }: { me: Me }) {
  const { setMe } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const w = me.woman!;
  const [name, setName] = useState(me.display_name);
  const [area, setArea] = useState(me.area || w.areas[0] || '');
  const [headline, setHeadline] = useState(w.headline);
  const [bio, setBio] = useState(w.bio);
  const [areas, setAreas] = useState<string[]>(w.areas);
  const [plans, setPlans] = useState<string[]>(w.plan_types);
  const [published, setPublished] = useState(w.is_published);
  const [venueName, setVenueName] = useState(w.venue?.name ?? '');
  const [venueArea, setVenueArea] = useState(w.venue?.area ?? '');
  const [venuePublic, setVenuePublic] = useState(w.venue?.is_public ?? false);

  const toggle = (list: string[], v: string, set: (x: string[]) => void, max: number) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : list.length >= max ? list : [...list, v]);

  const save = async () => {
    try {
      setMe(await call<Me>('update_woman_profile', {
        p_display_name: name, p_area: area, p_headline: headline, p_bio: bio, p_areas: areas, p_plan_types: plans, p_is_published: published,
      }));
      toast(published ? '保存しました（公開中）' : '保存しました（非公開）');
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  const saveVenue = async () => {
    try {
      setMe(await call<Me>('upsert_venue', { p_name: venueName, p_area: venueArea, p_is_public: venuePublic }));
      toast('所属店舗を保存しました。運営の確認後に反映されます');
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  const removeVenue = async () => {
    const r = await confirm({ title: '所属店舗の登録を削除しますか？', confirm: '削除する', danger: true });
    if (!r.ok) return;
    setMe(await call<Me>('delete_venue'));
    setVenueName('');
    setVenueArea('');
  };

  return (
    <>
      <Header title="プロフィール編集" />
      <Screen footer={<Button title="保存する" onPress={save} disabled={!name.trim()} testID="profile-save" />}>
        {me.verification.status !== 'approved' ? <Notice icon="shield" title="公開には本人確認が必要です">本人確認の完了後、プロフィールを公開できます。</Notice> : null}
        <Section title="PHOTOS ・ 写真" style={{ marginTop: space.lg }}><PhotoManager max={6} /></Section>
        <Section title="PROFILE">
          <Field label="表示名" value={name} onChangeText={setName} maxLength={30} hint="本名は入力しないでください" testID="profile-name" />
          <Field label="ひとこと" value={headline} onChangeText={setHeadline} maxLength={60} placeholder="例：静かなお店でゆっくりお話を" testID="profile-headline" />
          <Field label="自己紹介" value={bio} onChangeText={setBio} multiline maxLength={1000} hint={`${bio.length}/1000 ・ 連絡先・性的な表現・金銭のやりとりの記載は禁止です`} testID="profile-bio" />
        </Section>
        <Section title="AREA ・ 活動エリア（最大5つ）">
          <Row wrap gap={space.sm}>
            {AREAS.map((a) => <Chip key={a} label={a} selected={areas.includes(a)} onPress={() => { toggle(areas, a, setAreas, 5); if (!area) setArea(a); }} />)}
          </Row>
          <T v="small" style={{ marginTop: space.sm }}>正確な住所や最寄り駅は公開されません。</T>
          <Gap h={space.md} />
          <T v="small" style={{ marginBottom: space.sm, fontWeight: '600' }}>メインエリア</T>
          <Row wrap gap={space.sm}>{areas.map((a) => <Chip key={a} label={a} selected={area === a} onPress={() => setArea(a)} icon="pin" />)}</Row>
        </Section>
        <Section title="PLANS ・ 同席プラン">
          <Row wrap gap={space.sm}>{PLAN_TYPES.map((p) => <Chip key={p} label={p} selected={plans.includes(p)} onPress={() => toggle(plans, p, setPlans, 6)} />)}</Row>
        </Section>
        <Section title="VENUE ・ 所属店舗（任意）">
          <Card>
            {w.venue ? (
              <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
                <T v="sub">確認状況</T>
                <Pill label={{ pending: '運営確認中', approved: '確認済み', rejected: '確認できませんでした', unsubmitted: '未提出' }[w.venue.verify_status]} tone={w.venue.verify_status === 'approved' ? 'success' : 'gold'} />
              </Row>
            ) : null}
            <Field label="店舗名" value={venueName} onChangeText={setVenueName} maxLength={60} placeholder="例：Lounge ○○" />
            <Field label="店舗のエリア" value={venueArea} onChangeText={setVenueArea} maxLength={30} />
            <Toggle value={venuePublic} onChange={setVenuePublic} label="プロフィールに表示する" description="運営が在籍を確認できた場合のみ表示されます。店舗での売上はランクに使用しません" />
            <View style={{ gap: space.sm, marginTop: space.sm }}>
              <Button small variant="outline" title="店舗情報を保存" onPress={saveVenue} disabled={!venueName.trim()} />
              {w.venue ? <Button small variant="ghost" title="登録を削除" onPress={removeVenue} /> : null}
            </View>
          </Card>
        </Section>
        <Section title="VISIBILITY ・ 公開設定">
          <Card>
            <Toggle value={published} onChange={setPublished} label="プロフィールを公開する" description="公開すると、本人確認済みの男性会員の検索結果に表示されます" />
          </Card>
        </Section>
      </Screen>
    </>
  );
}
