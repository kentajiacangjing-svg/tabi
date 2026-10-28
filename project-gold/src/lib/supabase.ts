import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/** on: サーバーを使わず、ブラウザ内の PostgreSQL（PGlite）で動くデモ版（src/demo/gateway.ts） */
export const DEMO_BROWSER = process.env.EXPO_PUBLIC_DEMO_BROWSER === 'on';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const demo: typeof import('../demo/gateway') | null = DEMO_BROWSER ? require('../demo/gateway') : null;
export const demoFetch = demo?.demoFetch ?? null;
export const resetDemo = demo?.resetDemo ?? null;
export const SUPABASE_URL = demo ? demo.DEMO_URL : (process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321');
export const SUPABASE_ANON_KEY = demo ? 'demo-anon-key' : (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '');
/** on: Supabase Realtime で購読 / off: ポーリング（ローカル開発サーバーは Realtime 非対応） */
export const REALTIME_ENABLED = process.env.EXPO_PUBLIC_REALTIME === 'on';
export const PHOTO_BUCKET = 'profile-photos';

const webStorage = {
  getItem: (k: string) => {
    try {
      return typeof window === 'undefined' ? null : window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k: string, v: string) => {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(k, v);
    } catch {}
  },
  removeItem: (k: string) => {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(k);
    } catch {}
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? webStorage : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Web のパスワード再設定リンク（#access_token=...&type=recovery）を取り込む
    detectSessionInUrl: Platform.OS === 'web' && !DEMO_BROWSER,
  },
  ...(demoFetch ? { global: { fetch: demoFetch } } : {}),
});
