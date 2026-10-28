import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
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
    detectSessionInUrl: Platform.OS === 'web',
  },
});
