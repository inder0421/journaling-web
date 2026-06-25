import { getSupabase, isSupabaseConfigured } from "./supabase";
import { DEFAULT_RULES, NewTrade, Rules, Trade } from "./types";

/*
  Data layer. One async interface, two backends:
    - Supabase (default when env is configured): Postgres + RLS, real
      cross-device sync.
    - localStorage (fallback): works immediately, single-device.
  The UI never branches on the backend; it just awaits these functions.
*/

const LS_TRADES = "dj.trades.v1";
const LS_RULES = "dj.rules.v1";

function lsRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsWrite<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------- trades

export async function listTrades(): Promise<Trade[]> {
  if (isSupabaseConfigured) {
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from("trades")
      .select("id, created_at, setup_met, entry_reason, result, amount, instrument")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Trade[];
  }
  const trades = lsRead<Trade[]>(LS_TRADES, []);
  return [...trades].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function addTrade(input: NewTrade): Promise<Trade> {
  const trade: Trade = {
    id: newId(),
    created_at: input.created_at ?? new Date().toISOString(),
    setup_met: input.setup_met,
    entry_reason: input.entry_reason,
    result: input.result,
    amount: Math.abs(input.amount || 0),
    instrument: input.instrument,
  };

  if (isSupabaseConfigured) {
    const sb = getSupabase()!;
    // user_id is filled by a column default (auth.uid()); RLS enforces scope.
    const { data, error } = await sb
      .from("trades")
      .insert({
        created_at: trade.created_at,
        setup_met: trade.setup_met,
        entry_reason: trade.entry_reason,
        result: trade.result,
        amount: trade.amount,
        instrument: trade.instrument,
      })
      .select("id, created_at, setup_met, entry_reason, result, amount, instrument")
      .single();
    if (error) throw error;
    return data as Trade;
  }

  const trades = lsRead<Trade[]>(LS_TRADES, []);
  trades.push(trade);
  lsWrite(LS_TRADES, trades);
  return trade;
}

export async function deleteTrade(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    const sb = getSupabase()!;
    const { error } = await sb.from("trades").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  const trades = lsRead<Trade[]>(LS_TRADES, []).filter((t) => t.id !== id);
  lsWrite(LS_TRADES, trades);
}

// ----------------------------------------------------------------- rules

export async function getRules(): Promise<Rules> {
  if (isSupabaseConfigured) {
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from("rules")
      .select(
        "daily_stop_loss, max_trades_per_day, starting_balance, max_drawdown_floor"
      )
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ...DEFAULT_RULES };
    return data as Rules;
  }
  return lsRead<Rules>(LS_RULES, { ...DEFAULT_RULES });
}

export async function saveRules(rules: Rules): Promise<Rules> {
  const clean: Rules = {
    daily_stop_loss: Math.max(0, Number(rules.daily_stop_loss) || 0),
    max_trades_per_day: Math.max(0, Math.floor(Number(rules.max_trades_per_day) || 0)),
    starting_balance: Number(rules.starting_balance) || 0,
    max_drawdown_floor: Number(rules.max_drawdown_floor) || 0,
  };

  if (isSupabaseConfigured) {
    const sb = getSupabase()!;
    const { data: userData } = await sb.auth.getUser();
    const uid = userData.user?.id;
    // user_id is the PK; include it so upsert can resolve the conflict target.
    const { error } = await sb
      .from("rules")
      .upsert({ user_id: uid, ...clean }, { onConflict: "user_id" });
    if (error) throw error;
    return clean;
  }

  lsWrite(LS_RULES, clean);
  return clean;
}

// ------------------------------------------------------------- realtime

/** Subscribe to remote trade/rule changes for live cross-device sync.
 *  Returns an unsubscribe function. No-op in local mode. */
export function subscribeChanges(onChange: () => void): () => void {
  if (!isSupabaseConfigured) {
    // Cross-tab sync in local mode.
    if (typeof window === "undefined") return () => {};
    const handler = (e: StorageEvent) => {
      if (e.key === LS_TRADES || e.key === LS_RULES) onChange();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }

  const sb = getSupabase()!;
  const channel = sb
    .channel("dj-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "trades" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "rules" }, onChange)
    .subscribe();

  return () => {
    sb.removeChannel(channel);
  };
}
