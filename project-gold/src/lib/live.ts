import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { REALTIME_ENABLED, supabase } from './supabase';

/**
 * 新着の検知。Supabase では Realtime（RLS で当事者のみ配信）、ローカル開発サーバーではポーリング。
 * どちらの場合も実データの取得は RPC で行う。
 */
export function useLive(channelKey: string | null, table: 'messages' | 'notifications', filter: string | null, onChange: () => void, intervalMs = 4000) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });
  useEffect(() => {
    if (!channelKey) return;
    if (REALTIME_ENABLED) {
      const ch = supabase
        .channel(channelKey)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table, ...(filter ? { filter } : {}) }, () => cb.current())
        .subscribe();
      return () => {
        supabase.removeChannel(ch);
      };
    }
    let active = AppState.currentState === 'active';
    const sub = AppState.addEventListener('change', (s) => {
      active = s === 'active';
      if (active) cb.current();
    });
    const t = setInterval(() => {
      if (active) cb.current();
    }, intervalMs);
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [channelKey, table, filter, intervalMs]);
}
