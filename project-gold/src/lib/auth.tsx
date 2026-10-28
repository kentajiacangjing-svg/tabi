import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { call, toMessage } from './api';
import { supabase } from './supabase';
import type { Me, PublicSettings, Role } from './types';

type AuthState = {
  ready: boolean;
  session: Session | null;
  me: Me | null;
  settings: PublicSettings | null;
  meError: string | null;
  /** パスワード再設定リンクから入った状態 */
  recovery: boolean;
  refreshMe: () => Promise<Me | null>;
  setMe: (me: Me) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, role: Exclude<Role, 'admin'>, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearRecovery: () => void;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [recovery, setRecovery] = useState(false);

  const refreshMe = useCallback(async () => {
    try {
      const m = await call<Me>('get_me');
      setMe(m);
      setMeError(null);
      return m;
    } catch (e) {
      setMeError(toMessage(e));
      return null;
    }
  }, []);

  useEffect(() => {
    call<PublicSettings>('get_public_settings').then(setSettings).catch(() => {});
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) await refreshMe();
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (!s) setMe(null);
      else if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') setTimeout(() => refreshMe(), 0);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [refreshMe]);

  const value = useMemo<AuthState>(
    () => ({
      ready, session, me, settings, meError, recovery, refreshMe, setMe,
      clearRecovery: () => setRecovery(false),
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(toMessage(error));
        await refreshMe();
      },
      signUp: async (email, password, role, displayName) => {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password, options: { data: { role, display_name: displayName.trim() } },
        });
        if (error) throw new Error(toMessage(error));
        if (!data.session) throw new Error('確認メールを送信しました。メール内のリンクから登録を完了してください');
        await refreshMe();
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setMe(null);
      },
    }),
    [ready, session, me, settings, meError, recovery, refreshMe]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
}

export function useServiceName() {
  const { settings } = useAuth();
  return (settings?.settings?.service_name as string) || 'PROJECT GOLD';
}
