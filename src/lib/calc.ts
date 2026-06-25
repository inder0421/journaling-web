import { Rules, Trade } from "./types";

/** Signed P&L for a trade. Wins add, losses subtract; breakeven and
 *  no-trade are flat (no money changed hands). */
export function pnlOf(t: Trade): number {
  const amt = Math.abs(t.amount || 0);
  if (t.result === "win") return amt;
  if (t.result === "loss") return -amt;
  return 0; // breakeven or no_trade
}

/** A "taken" trade is one you actually entered (win/loss/breakeven).
 *  A no-trade is the opposite — restraint — and is excluded from trade
 *  counts, the lockout, and win-rate analytics. */
export function isTakenTrade(t: Trade): boolean {
  return t.result !== "no_trade";
}

export function takenTrades(trades: Trade[]): Trade[] {
  return trades.filter(isTakenTrade);
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

/** Net P&L for today (local day). No-trades contribute 0. */
export function dailyPnl(trades: Trade[], now: Date = new Date()): number {
  return tradesOnDay(trades, now).reduce((sum, t) => sum + pnlOf(t), 0);
}

/** Number of trades actually TAKEN today (excludes no-trades), which is
 *  what the max-trades lockout counts against. */
export function tradeCountToday(trades: Trade[], now: Date = new Date()): number {
  return tradesOnDay(trades, now).filter(isTakenTrade).length;
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
 * Max trades is hit when today's TAKEN-trade count reaches the configured cap.
 * No-trades never lock you out — restraint should never be penalized.
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

/** Count of no-trades (restraint) logged all-time. */
export function noTradeCount(trades: Trade[]): number {
  return trades.filter((t) => t.result === "no_trade").length;
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
  breakevens: number;
  /** wins / (wins + losses); null when no decisive trades yet. */
  winRate: number | null;
  netPnl: number;
}

function statsFor(trades: Trade[]): SplitStats {
  const wins = trades.filter((t) => t.result === "win").length;
  const losses = trades.filter((t) => t.result === "loss").length;
  const breakevens = trades.filter((t) => t.result === "breakeven").length;
  const decisive = wins + losses;
  return {
    trades: trades.length,
    wins,
    losses,
    breakevens,
    winRate: decisive > 0 ? wins / decisive : null,
    netPnl: netPnl(trades),
  };
}

/** On-criteria vs off-criteria (impulse) breakdown — the headline contrast.
 *  Only TAKEN trades count; no-trades are excluded. */
export function criteriaSplit(trades: Trade[]): {
  onCriteria: SplitStats;
  offCriteria: SplitStats;
} {
  const taken = takenTrades(trades);
  return {
    onCriteria: statsFor(taken.filter((t) => t.setup_met)),
    offCriteria: statsFor(taken.filter((t) => !t.setup_met)),
  };
}

export interface DaySummary {
  key: string; // YYYY-MM-DD
  date: Date;
  trades: Trade[]; // all entries that day, incl. no-trades (for the row list)
  pnl: number;
  takenCount: number; // trades actually taken
  onCount: number; // taken & on-setup
  offCount: number; // taken & off-setup (impulse)
  noCount: number; // no-trades (restraint)
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
    const taken = dayTrades.filter(isTakenTrade);
    out.push({
      key,
      date: new Date(dayTrades[0].created_at),
      trades: dayTrades.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
      pnl: dayTrades.reduce((s, t) => s + pnlOf(t), 0),
      takenCount: taken.length,
      onCount: taken.filter((t) => t.setup_met).length,
      offCount: taken.filter((t) => !t.setup_met).length,
      noCount: dayTrades.length - taken.length,
    });
  }
  return out.sort((a, b) => b.key.localeCompare(a.key));
}

export interface WeekSummary {
  key: string; // YYYY-Www
  label: string;
  pnl: number;
  takenCount: number;
  onCount: number;
  offCount: number;
  noCount: number;
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
      ({
        key,
        label,
        pnl: 0,
        takenCount: 0,
        onCount: 0,
        offCount: 0,
        noCount: 0,
      } as WeekSummary);
    cur.pnl += pnlOf(t);
    if (isTakenTrade(t)) {
      cur.takenCount += 1;
      cur.onCount += t.setup_met ? 1 : 0;
      cur.offCount += t.setup_met ? 0 : 1;
    } else {
      cur.noCount += 1;
    }
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}
