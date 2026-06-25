import { supabase } from './supabase';
import type { NewTrade, Rules, Trade } from './types';

/** Sensible defaults that match the documented problem (max 2/day, -$500 stop). */
export const DEFAULT_RULES: Rules = {
  daily_stop_loss: 500,
  max_trades_per_day: 2,
  starting_balance: 50000,
  max_drawdown_floor: 48000,
};

/** Backend-agnostic data interface. Components never talk to a backend directly. */
export interface Store {
  loadRules(): Promise<Rules>;
  saveRules(rules: Rules): Promise<Rules>;
  loadTrades(): Promise<Trade[]>;
  addTrade(trade: NewTrade): Promise<Trade>;
  deleteTrade(id: string): Promise<void>;
  /** Optional live updates from other devices. Returns an unsubscribe fn. */
  subscribe?(onChange: () => void): () => void;
}

/* ------------------------------------------------------------------ */
/* Local-only store (browser localStorage). The fallback when Supabase */
/* is not configured.                                                  */
/* ------------------------------------------------------------------ */

const TRADES_KEY = 'tdj:trades';
const RULES_KEY = 'tdj:rules';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createLocalStore(): Store {
  return {
    async loadRules() {
      return { ...DEFAULT_RULES, ...readJson<Partial<Rules>>(RULES_KEY, {}) };
    },
    async saveRules(rules) {
      writeJson(RULES_KEY, rules);
      return rules;
    },
    async loadTrades() {
      return readJson<Trade[]>(TRADES_KEY, []);
    },
    async addTrade(trade) {
      const full: Trade = { ...trade, id: newId(), created_at: new Date().toISOString() };
      const all = readJson<Trade[]>(TRADES_KEY, []);
      writeJson(TRADES_KEY, [full, ...all]);
      return full;
    },
    async deleteTrade(id) {
      const all = readJson<Trade[]>(TRADES_KEY, []);
      writeJson(
        TRADES_KEY,
        all.filter((t) => t.id !== id),
      );
    },
  };
}

/** Whether the local store holds any data worth migrating to the cloud. */
export function hasLocalData(): boolean {
  return readJson<Trade[]>(TRADES_KEY, []).length > 0;
}

export function readLocalTrades(): Trade[] {
  return readJson<Trade[]>(TRADES_KEY, []);
}

export function clearLocalData(): void {
  localStorage.removeItem(TRADES_KEY);
  localStorage.removeItem(RULES_KEY);
}

/* ------------------------------------------------------------------ */
/* Cloud store (Supabase / Postgres). The default working path.       */
/* ------------------------------------------------------------------ */

export function createCloudStore(userId: string): Store {
  if (!supabase) throw new Error('Supabase is not configured');
  const db = supabase;

  return {
    async loadRules() {
      const { data, error } = await db.from('rules').select('*').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      if (data) return data as Rules;
      // First run for this user: create the default row (idempotent on user_id).
      const seed = { ...DEFAULT_RULES, user_id: userId };
      const { data: created, error: insErr } = await db
        .from('rules')
        .upsert(seed, { onConflict: 'user_id' })
        .select()
        .single();
      if (insErr) throw insErr;
      return created as Rules;
    },

    async saveRules(rules) {
      const payload = {
        user_id: userId,
        daily_stop_loss: rules.daily_stop_loss,
        max_trades_per_day: rules.max_trades_per_day,
        starting_balance: rules.starting_balance,
        max_drawdown_floor: rules.max_drawdown_floor,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await db
        .from('rules')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      return data as Rules;
    },

    async loadTrades() {
      const { data, error } = await db
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .order('traded_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Trade[];
    },

    async addTrade(trade) {
      const { data, error } = await db
        .from('trades')
        .insert({ ...trade, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data as Trade;
    },

    async deleteTrade(id) {
      const { error } = await db.from('trades').delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
    },

    subscribe(onChange) {
      const channel = db
        .channel(`tdj-${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'trades', filter: `user_id=eq.${userId}` },
          () => onChange(),
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rules', filter: `user_id=eq.${userId}` },
          () => onChange(),
        )
        .subscribe();
      return () => {
        void db.removeChannel(channel);
      };
    },
  };
}

/** Upload any locally-stored trades to the cloud store (one-time migration helper). */
export async function migrateLocalToCloud(cloud: Store): Promise<number> {
  const local = readLocalTrades();
  let migrated = 0;
  // Insert oldest first so created order is preserved.
  for (const t of [...local].reverse()) {
    const { id: _id, user_id: _u, created_at: _c, ...rest } = t;
    void _id;
    void _u;
    void _c;
    await cloud.addTrade(rest);
    migrated += 1;
  }
  if (migrated > 0) clearLocalData();
  return migrated;
}
