import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  createCloudStore,
  createLocalStore,
  DEFAULT_RULES,
  hasLocalData,
  migrateLocalToCloud,
  type Store,
} from '../lib/storage';
import type { NewTrade, Rules, Trade } from '../lib/types';

export type Mode = 'local' | 'cloud' | 'auth';

interface AuthResult {
  error?: string;
  info?: string;
}

interface AppDataValue {
  mode: Mode;
  ready: boolean;
  loading: boolean;
  error: string | null;
  email: string | null;
  rules: Rules;
  trades: Trade[];
  addTrade: (trade: NewTrade) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
  saveRules: (rules: Rules) => Promise<void>;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  localDataAvailable: boolean;
  migrateLocal: () => Promise<number>;
}

const AppDataContext = createContext<AppDataValue | null>(null);

function errMsg(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);

  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localDataAvailable, setLocalDataAvailable] = useState(false);

  // Track auth session when running against Supabase.
  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const mode: Mode = !isSupabaseConfigured ? 'local' : session ? 'cloud' : 'auth';

  const store = useMemo<Store | null>(() => {
    if (!isSupabaseConfigured) return createLocalStore();
    if (session) return createCloudStore(session.user.id);
    return null;
  }, [session]);

  const refresh = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    try {
      const [r, t] = await Promise.all([store.loadRules(), store.loadTrades()]);
      setRules(r);
      setTrades(t);
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
      setDataReady(true);
    }
  }, [store]);

  // Initial load whenever the active store changes (sign-in / sign-out / mode).
  useEffect(() => {
    setDataReady(false);
    if (store) {
      void refresh();
    } else {
      setDataReady(true); // auth screen: nothing to load yet
    }
    setLocalDataAvailable(mode === 'cloud' && hasLocalData());
  }, [store, refresh, mode]);

  // Live updates from other devices (Supabase realtime), if available.
  useEffect(() => {
    if (!store?.subscribe) return;
    const unsub = store.subscribe(() => void refresh());
    return unsub;
  }, [store, refresh]);

  // Re-sync when the tab regains focus — covers logging on another device.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (!store) return;
    const onFocus = () => void refreshRef.current();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [store]);

  const addTrade = useCallback(
    async (trade: NewTrade) => {
      if (!store) return;
      const created = await store.addTrade(trade);
      setTrades((prev) => [created, ...prev.filter((t) => t.id !== created.id)]);
    },
    [store],
  );

  const deleteTrade = useCallback(
    async (id: string) => {
      if (!store) return;
      await store.deleteTrade(id);
      setTrades((prev) => prev.filter((t) => t.id !== id));
    },
    [store],
  );

  const saveRules = useCallback(
    async (next: Rules) => {
      if (!store) return;
      const saved = await store.saveRules(next);
      setRules(saved);
    },
    [store],
  );

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { error: 'Sync is not configured.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { error: 'Sync is not configured.' };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (!data.session) {
      return {
        info: 'Account created. Confirm via the email Supabase sent, then sign in. (Or disable email confirmation in Supabase for instant access.)',
      };
    }
    return {};
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const migrateLocal = useCallback(async () => {
    if (!store) return 0;
    const n = await migrateLocalToCloud(store);
    await refresh();
    setLocalDataAvailable(hasLocalData());
    return n;
  }, [store, refresh]);

  const value: AppDataValue = {
    mode,
    ready: authReady && dataReady,
    loading,
    error,
    email: session?.user.email ?? null,
    rules,
    trades,
    addTrade,
    deleteTrade,
    saveRules,
    refresh,
    signIn,
    signUp,
    signOut,
    localDataAvailable,
    migrateLocal,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
