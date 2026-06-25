import { Rules, Trade } from "./types";

/** Signed P&L for a trade. Wins add, losses subtract, scratches are flat. */
export function pnlOf(t: Trade): number {
  const amt = Math.abs(t.amount || 0);
  if (t.result === "win") return amt;
  if (t.result === "loss") return -amt;
  return 0; // scratch = breakeven
}

/** True if two dates fall on the same calendar day in the local timezone. */
export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Local YYYY-MM-DD key for grouping. */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function tradesOnDay(trades: Trade[], now: Date): Trade[] {
  return trades.filter((t) => isSameLocalDay(new Date(t.created_at), now));
}

/** Net P&L for today (local day). */
export function dailyPnl(trades: Trade[], now: Date = new Date()): number {
  return tradesOnDay(trades, now).reduce((sum, t) => sum + pnlOf(t), 0);
}

export function tradeCountToday(trades: Trade[], now: Date = new Date()): number {
  return tradesOnDay(trades, now).length;
}

export interface LockoutState {
  locked: boolean;
  stopHit: boolean;
  maxTradesHit: boolean;
  dailyPnl: number;
  count: number;
  tradesRemaining: number; // can be negative-safe; clamped to >= 0
  lossRoomRemaining: number; // dollars left before daily stop, >= 0
}

/**
 * The hard-lockout decision. The form must be fully disabled when `locked`.
 * Daily stop is hit when today's NET P&L is at or below the negative stop.
 * Max trades is hit when today's trade count reaches the configured cap.
 */
export function lockoutState(
  trades: Trade[],
  rules: Rules,
  now: Date = new Date()
): LockoutState {
  const pnl = dailyPnl(trades, now);
  const count = tradeCountToday(trades, now);

  const stopEnabled = rules.daily_stop_loss > 0;
  const maxEnabled = rules.max_trades_per_day > 0;

  const stopHit = stopEnabled && pnl <= -rules.daily_stop_loss;
  const maxTradesHit = maxEnabled && count >= rules.max_trades_per_day;

  return {
    locked: stopHit || maxTradesHit,
    stopHit,
    maxTradesHit,
    dailyPnl: pnl,
    count,
    tradesRemaining: maxEnabled
      ? Math.max(0, rules.max_trades_per_day - count)
      : Infinity,
    lossRoomRemaining: stopEnabled
      ? Math.max(0, rules.daily_stop_loss + Math.min(0, pnl))
      : Infinity,
  };
}

/** Sum of all losing trades, all-time, as a positive number. */
export function cumulativeLosses(trades: Trade[]): number {
  return trades
    .filter((t) => t.result === "loss")
    .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
}

/** Net P&L across all trades, all-time (signed). */
export function netPnl(trades: Trade[]): number {
  return trades.reduce((sum, t) => sum + pnlOf(t), 0);
}

/** Live account balance = starting balance + all-time net P&L. */
export function currentBalance(trades: Trade[], rules: Rules): number {
  return rules.starting_balance + netPnl(trades);
}

/**
 * Running account cushion, exactly as specified for this trader:
 *   (starting balance − max drawdown floor) − cumulative losses
 *
 * This is the *conservative* safety number: the drawdown allowance reduced
 * by realized losses only. Wins do NOT replenish it, so it never masks how
 * much real room has been burned. When it hits zero, the account is blown.
 */
export function accountCushion(trades: Trade[], rules: Rules): number {
  const allowance = rules.starting_balance - rules.max_drawdown_floor;
  return allowance - cumulativeLosses(trades);
}

export interface SplitStats {
  trades: number;
  wins: number;
  losses: number;
  scratches: number;
  /** wins / (wins + losses); null when no decisive trades yet. */
  winRate: number | null;
  netPnl: number;
}

function statsFor(trades: Trade[]): SplitStats {
  const wins = trades.filter((t) => t.result === "win").length;
  const losses = trades.filter((t) => t.result === "loss").length;
  const scratches = trades.filter((t) => t.result === "scratch").length;
  const decisive = wins + losses;
  return {
    trades: trades.length,
    wins,
    losses,
    scratches,
    winRate: decisive > 0 ? wins / decisive : null,
    netPnl: netPnl(trades),
  };
}

/** On-criteria vs off-criteria (impulse) breakdown — the headline contrast. */
export function criteriaSplit(trades: Trade[]): {
  onCriteria: SplitStats;
  offCriteria: SplitStats;
} {
  return {
    onCriteria: statsFor(trades.filter((t) => t.setup_met)),
    offCriteria: statsFor(trades.filter((t) => !t.setup_met)),
  };
}

export interface DaySummary {
  key: string; // YYYY-MM-DD
  date: Date;
  trades: Trade[];
  pnl: number;
  onCount: number;
  offCount: number;
}

/** Group trades by local day, most recent first. */
export function groupByDay(trades: Trade[]): DaySummary[] {
  const map = new Map<string, Trade[]>();
  for (const t of trades) {
    const k = dayKey(new Date(t.created_at));
    const arr = map.get(k);
    if (arr) arr.push(t);
    else map.set(k, [t]);
  }
  const out: DaySummary[] = [];
  for (const [key, dayTrades] of map) {
    out.push({
      key,
      date: new Date(dayTrades[0].created_at),
      trades: dayTrades.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
      pnl: dayTrades.reduce((s, t) => s + pnlOf(t), 0),
      onCount: dayTrades.filter((t) => t.setup_met).length,
      offCount: dayTrades.filter((t) => !t.setup_met).length,
    });
  }
  return out.sort((a, b) => b.key.localeCompare(a.key));
}

export interface WeekSummary {
  key: string; // YYYY-Www
  label: string;
  pnl: number;
  trades: number;
  onCount: number;
  offCount: number;
}

function weekKey(d: Date): { key: string; label: string } {
  // ISO week number
  const date = new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  );
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = date.getTime();
  date.setUTCMonth(0, 1);
  if (date.getUTCDay() !== 4) {
    date.setUTCMonth(0, 1 + ((4 - date.getUTCDay() + 7) % 7));
  }
  const week =
    1 + Math.ceil((firstThursday - date.getTime()) / (7 * 24 * 3600 * 1000));
  const y = new Date(firstThursday).getUTCFullYear();
  return {
    key: `${y}-W${String(week).padStart(2, "0")}`,
    label: `Week ${week}, ${y}`,
  };
}

/** Group trades by ISO week, most recent first. */
export function groupByWeek(trades: Trade[]): WeekSummary[] {
  const map = new Map<string, WeekSummary>();
  for (const t of trades) {
    const { key, label } = weekKey(new Date(t.created_at));
    const cur =
      map.get(key) ??
      ({ key, label, pnl: 0, trades: 0, onCount: 0, offCount: 0 } as WeekSummary);
    cur.pnl += pnlOf(t);
    cur.trades += 1;
    cur.onCount += t.setup_met ? 1 : 0;
    cur.offCount += t.setup_met ? 0 : 1;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}
