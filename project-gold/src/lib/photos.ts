import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { PHOTO_BUCKET, supabase } from './supabase';

/** 非公開バケットの写真は署名付きURLで表示する（メモリキャッシュ付き） */
const cache = new Map<string, { url: string; exp: number }>();
const inflight = new Map<string, Promise<void>>();

async function signMany(paths: string[]) {
  const need = paths.filter((p) => {
    const c = cache.get(p);
    return !c || c.exp < Date.now() + 60_000;
  });
  if (!need.length) return;
  const key = need.join('|');
  if (!inflight.has(key)) {
    inflight.set(
      key,
      (async () => {
        const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(need, 3600);
        for (const d of data ?? []) {
          if (d.signedUrl && d.path) cache.set(d.path, { url: d.signedUrl, exp: Date.now() + 3600_000 });
        }
      })().finally(() => inflight.delete(key))
    );
  }
  await inflight.get(key);
}

export function useSignedUrls(paths: (string | null | undefined)[]) {
  const list = paths.filter(Boolean) as string[];
  const key = list.join('|');
  const [urls, setUrls] = useState<Record<string, string>>(() =>
    Object.fromEntries(list.filter((p) => cache.has(p)).map((p) => [p, cache.get(p)!.url]))
  );
  useEffect(() => {
    let alive = true;
    if (!list.length) return;
    signMany(list).then(() => {
      if (alive) setUrls(Object.fromEntries(list.filter((p) => cache.has(p)).map((p) => [p, cache.get(p)!.url])));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}

export async function pickAndUploadPhoto(userId: string): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted && Platform.OS !== 'web') throw new Error('写真へのアクセスを許可してください（設定アプリから変更できます）');
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.85 });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  const mime = asset.mimeType && /^image\/(jpeg|png|webp|heic)$/.test(asset.mimeType) ? asset.mimeType : 'image/jpeg';
  const ext = mime.split('/')[1].replace('jpeg', 'jpg');
  const body = await (await fetch(asset.uri)).arrayBuffer();
  if (body.byteLength > 5 * 1024 * 1024) throw new Error('画像は5MB以下にしてください');
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, body, { contentType: mime, upsert: false });
  if (error) throw new Error('画像のアップロードに失敗しました');
  return path;
}
