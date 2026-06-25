import type { Rules, Trade, TradeResult } from './types';

/**
 * Pure, fully-tested domain logic. No React, no I/O.
 * This is where the discipline rules actually live, so it gets unit tests.
 */

/** Convert an entered magnitude + result into a signed P&L value. */
export function signedPnl(amount: number, result: TradeResult): number {
  const mag = Math.abs(Number(amount)) || 0;
  if (result === 'win') return mag;
  if (result === 'loss') return -mag;
  return 0; // scratch / break-even
}

/** Local calendar day key (YYYY-MM-DD) for a timestamp, in the viewer's timezone. */
export function localDateKey(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local week-start (Monday) key for grouping. */
export function weekStartKey(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : new Date(input);
  const mondayOffset = (d.getDay() + 6) % 7; // Sun=0 -> 6, Mon=1 -> 0, ...
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayOffset);
  return localDateKey(monday);
}

export function tradesOnDay(trades: Trade[], dayKey: string): Trade[] {
  return trades.filter((t) => localDateKey(t.traded_at) === dayKey);
}

export function sumPnl(trades: Trade[]): number {
  return trades.reduce((acc, t) => acc + t.pnl, 0);
}

/** Total dollars lost across all losing trades, returned as a positive number. */
export function cumulativeLosses(trades: Trade[]): number {
  return trades.reduce((acc, t) => acc + (t.pnl < 0 ? -t.pnl : 0), 0);
}

/** Total dollars won across all winning trades. */
export function cumulativeWins(trades: Trade[]): number {
  return trades.reduce((acc, t) => acc + (t.pnl > 0 ? t.pnl : 0), 0);
}

/** Account balance right now: starting balance plus net realized P&L. */
export function currentBalance(rules: Rules, trades: Trade[]): number {
  return rules.starting_balance + sumPnl(trades);
}

/**
 * Real remaining room in dollars before the account is blown:
 *   current balance - drawdown floor
 * Equivalently: (starting - floor) + cumulative wins - cumulative losses.
 */
export function cushionRemaining(rules: Rules, trades: Trade[]): number {
  return currentBalance(rules, trades) - rules.max_drawdown_floor;
}

/** The total drawdown room the account started with. */
export function initialCushion(rules: Rules): number {
  return rules.starting_balance - rules.max_drawdown_floor;
}

export interface DayStats {
  pnl: number;
  tradeCount: number;
}

export function todayStats(trades: Trade[], now: Date = new Date()): DayStats {
  const today = tradesOnDay(trades, localDateKey(now));
  return { pnl: sumPnl(today), tradeCount: today.length };
}

export interface LockoutState {
  locked: boolean;
  dailyStopHit: boolean;
  maxTradesHit: boolean;
  floorBreached: boolean;
  todayPnl: number;
  todayCount: number;
}

/**
 * The enforcement core. Returns whether logging should be locked and why.
 * Triggers: daily stop reached, max trades reached, or drawdown floor breached.
 */
export function lockoutState(rules: Rules, trades: Trade[], now: Date = new Date()): LockoutState {
  const { pnl, tradeCount } = todayStats(trades, now);
  const dailyStopHit = rules.daily_stop_loss > 0 && pnl <= -Math.abs(rules.daily_stop_loss);
  const maxTradesHit = rules.max_trades_per_day > 0 && tradeCount >= rules.max_trades_per_day;
  const floorBreached = cushionRemaining(rules, trades) <= 0;
  return {
    locked: dailyStopHit || maxTradesHit || floorBreached,
    dailyStopHit,
    maxTradesHit,
    floorBreached,
    todayPnl: pnl,
    todayCount: tradeCount,
  };
}

export interface GroupStats {
  count: number;
  wins: number;
  losses: number;
  scratches: number;
  netPnl: number;
  /** wins / (wins + losses); null when there are no decisive trades. */
  winRate: number | null;
  /** net P&L / count; null when there are no trades. */
  avgPnl: number | null;
}

export function groupStats(trades: Trade[]): GroupStats {
  const wins = trades.filter((t) => t.result === 'win').length;
  const losses = trades.filter((t) => t.result === 'loss').length;
  const scratches = trades.filter((t) => t.result === 'scratch').length;
  const decisive = wins + losses;
  const netPnl = sumPnl(trades);
  return {
    count: trades.length,
    wins,
    losses,
    scratches,
    netPnl,
    winRate: decisive > 0 ? wins / decisive : null,
    avgPnl: trades.length > 0 ? netPnl / trades.length : null,
  };
}

export function onCriteria(trades: Trade[]): Trade[] {
  return trades.filter((t) => t.setup_criteria_met);
}

export function offCriteria(trades: Trade[]): Trade[] {
  return trades.filter((t) => !t.setup_criteria_met);
}

export interface PeriodSummary {
  key: string;
  trades: Trade[];
  netPnl: number;
  tradeCount: number;
  onCriteriaCount: number;
  impulseCount: number;
  exceededMaxTrades: boolean;
  hitDailyStop: boolean;
}

function summarize(key: string, dayTrades: Trade[], rules: Rules): PeriodSummary {
  const sorted = [...dayTrades].sort((a, b) => a.traded_at.localeCompare(b.traded_at));
  const netPnl = sumPnl(dayTrades);
  return {
    key,
    trades: sorted,
    netPnl,
    tradeCount: dayTrades.length,
    onCriteriaCount: onCriteria(dayTrades).length,
    impulseCount: offCriteria(dayTrades).length,
    exceededMaxTrades: rules.max_trades_per_day > 0 && dayTrades.length > rules.max_trades_per_day,
    hitDailyStop: rules.daily_stop_loss > 0 && netPnl <= -Math.abs(rules.daily_stop_loss),
  };
}

function groupBy(trades: Trade[], keyFn: (t: Trade) => string): Map<string, Trade[]> {
  const map = new Map<string, Trade[]>();
  for (const t of trades) {
    const k = keyFn(t);
    const arr = map.get(k);
    if (arr) arr.push(t);
    else map.set(k, [t]);
  }
  return map;
}

/** Newest-first list of per-day summaries. */
export function summarizeByDay(trades: Trade[], rules: Rules): PeriodSummary[] {
  const map = groupBy(trades, (t) => localDateKey(t.traded_at));
  return [...map.entries()]
    .map(([key, dayTrades]) => summarize(key, dayTrades, rules))
    .sort((a, b) => b.key.localeCompare(a.key));
}

/** Newest-first list of per-week (Mon-start) summaries. */
export function summarizeByWeek(trades: Trade[], rules: Rules): PeriodSummary[] {
  const map = groupBy(trades, (t) => weekStartKey(t.traded_at));
  return [...map.entries()]
    .map(([key, weekTrades]) => summarize(key, weekTrades, rules))
    .sort((a, b) => b.key.localeCompare(a.key));
}
