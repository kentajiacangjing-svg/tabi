import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';

export class AppError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

/** サーバーからのエラーを利用者向けの日本語にそろえる */
export function toMessage(e: unknown): string {
  if (e instanceof AppError) return e.message;
  const msg = (e as { message?: string })?.message ?? '';
  if (/Failed to fetch|Network request failed|fetch failed/i.test(msg)) return '通信できませんでした。電波状況をご確認のうえ再度お試しください';
  if (/Invalid login credentials/i.test(msg)) return 'メールアドレスまたはパスワードが正しくありません';
  if (/already registered|already exists/i.test(msg)) return 'このメールアドレスは既に登録されています';
  if (/password/i.test(msg) && /(short|weak|characters)/i.test(msg)) return 'パスワードは8文字以上にしてください';
  if (/JWT|session/i.test(msg)) return 'ログインの有効期限が切れました。再度ログインしてください';
  return msg || 'エラーが発生しました。時間をおいて再度お試しください';
}

/** すべての書き込み・集計はサーバー側の RPC で確定する */
export async function call<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') throw new AppError('サーバーの機能が見つかりません（マイグレーション未適用の可能性）', error.code);
    if (error.code === '42501') throw new AppError('この操作は許可されていません', error.code);
    throw new AppError(error.message || 'エラーが発生しました', error.hint ?? error.code);
  }
  return data as T;
}

/**
 * RPC を読み込み・再読み込み・エラー状態つきで扱うフック。
 * 引数（JSON 化した値）が変わると自動で再取得する。
 */
export function useRpc<T>(fn: string | null, args: Record<string, unknown> = {}) {
  const argsJson = JSON.stringify(args);
  const key = `${fn}|${argsJson}`;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!fn) return;
    let alive = true;
    call<T>(fn, JSON.parse(argsJson))
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (alive) setError(toMessage(e));
      })
      .finally(() => {
        if (!alive) return;
        setLoadedKey(`${fn}|${argsJson}`);
        setRefreshing(false);
      });
    return () => {
      alive = false;
    };
  }, [fn, argsJson, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const refresh = useCallback(() => {
    setRefreshing(true);
    setNonce((n) => n + 1);
  }, []);

  return { data, setData, error, loading: !!fn && loadedKey !== key, refreshing, reload, refresh };
}
