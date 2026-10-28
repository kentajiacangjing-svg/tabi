import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Photo, Pill, T, useConfirm, useToast } from '@/components/ui';
import { call, toMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { pickAndUploadPhoto } from '@/lib/photos';
import type { Me } from '@/lib/types';
import { colors, radius, space } from '@/theme/tokens';

export function PhotoManager({ max }: { max: number }) {
  const { me, setMe } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  if (!me) return null;
  const items = me.photo_items;

  const add = async () => {
    try {
      const path = await pickAndUploadPhoto(me.id);
      if (!path) return;
      setMe(await call<Me>('add_photo', { p_path: path }));
      toast('写真を追加しました');
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  const makePrimary = async (id: string, index: number) => {
    if (index === 0) return;
    const r = await confirm({ title: 'メイン写真に設定しますか？', message: '検索結果の一覧に表示される写真です。', confirm: 'メインに設定' });
    if (!r.ok) return;
    try {
      setMe(await call<Me>('make_photo_primary', { p_id: id }));
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };
  const remove = async (id: string) => {
    const r = await confirm({ title: '写真を削除しますか？', confirm: '削除する', danger: true });
    if (r.ok) setMe(await call<Me>('delete_photo', { p_id: id }));
  };

  return (
    <View>
      <View style={styles.grid}>
        {items.map((p, i) => (
          <View key={p.id} style={styles.cell}>
            <Pressable onPress={() => makePrimary(p.id, i)} accessibilityRole="button" accessibilityLabel={`写真${i + 1}`}>
              <Photo path={p.path} style={{ width: '100%', aspectRatio: 4 / 5 }} rounded={radius.md} />
            </Pressable>
            <View style={styles.meta}>
              {i === 0 ? <Pill label="メイン" tone="dark" /> : <View />}
              <Pressable onPress={() => remove(p.id)} hitSlop={10} accessibilityLabel="削除" accessibilityRole="button"><Icon name="trash" size={16} color={colors.sub} /></Pressable>
            </View>
            {p.status === 'pending' ? <Pill label="審査中" tone="gold" /> : p.status === 'rejected' ? <Pill label="非承認" tone="danger" /> : null}
          </View>
        ))}
        {items.length < max ? (
          <Pressable onPress={add} style={[styles.cell, styles.add]} accessibilityRole="button" accessibilityLabel="写真を追加" testID="photo-add">
            <Icon name="plus" size={26} color={colors.gold} />
            <T v="small">写真を追加</T>
          </Pressable>
        ) : null}
      </View>
      <T v="small" style={{ marginTop: space.sm }}>
        最大{max}枚。ご本人が写った写真のみ（他人・著作権のある画像は不可）。顔の加工・露出の多い写真は審査で非承認になる場合があります。
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cell: { width: '30%', minWidth: 92, flexGrow: 0, gap: 4 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  add: { aspectRatio: 4 / 5, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.goldLight, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.surface },
});
