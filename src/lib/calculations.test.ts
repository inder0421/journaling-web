import { describe, it, expect } from 'vitest';
import {
  signedPnl,
  localDateKey,
  weekStartKey,
  sumPnl,
  cumulativeLosses,
  cumulativeWins,
  currentBalance,
  cushionRemaining,
  todayStats,
  lockoutState,
  groupStats,
  onCriteria,
  offCriteria,
  summarizeByDay,
} from './calculations';
import type { NewTrade, Rules, Trade } from './types';

const RULES: Rules = {
  daily_stop_loss: 500,
  max_trades_per_day: 2,
  starting_balance: 50000,
  max_drawdown_floor: 48000,
};

let counter = 0;
function trade(partial: Partial<NewTrade> & { result: Trade['result']; amount: number }): Trade {
  counter += 1;
  const { result, amount } = partial;
  return {
    id: `t${counter}`,
    setup_criteria_met: partial.setup_criteria_met ?? true,
    entry_reason: partial.entry_reason ?? '',
    result,
    amount,
    pnl: partial.pnl ?? signedPnl(amount, result),
    instrument: partial.instrument ?? 'ES',
    traded_at: partial.traded_at ?? new Date().toISOString(),
  };
}

describe('signedPnl', () => {
  it('makes wins positive, losses negative, scratches zero', () => {
    expect(signedPnl(300, 'win')).toBe(300);
    expect(signedPnl(300, 'loss')).toBe(-300);
    expect(signedPnl(300, 'scratch')).toBe(0);
  });
  it('ignores the sign of the entered amount', () => {
    expect(signedPnl(-300, 'win')).toBe(300);
    expect(signedPnl(-300, 'loss')).toBe(-300);
  });
});

describe('date keys', () => {
  it('formats a local day key', () => {
    expect(localDateKey(new Date(2025, 5, 23, 14, 0))).toBe('2025-06-23');
  });
  it('finds the Monday for a week key', () => {
    // 2025-06-25 is a Wednesday -> week starts Mon 2025-06-23
    expect(weekStartKey(new Date(2025, 5, 25))).toBe('2025-06-23');
    // Sunday belongs to the week that started the previous Monday
    expect(weekStartKey(new Date(2025, 5, 29))).toBe('2025-06-23');
    // The following Monday starts a new week
    expect(weekStartKey(new Date(2025, 5, 30))).toBe('2025-06-30');
  });
});

describe('money aggregates', () => {
  const trades = [
    trade({ result: 'win', amount: 400 }),
    trade({ result: 'loss', amount: 250 }),
    trade({ result: 'scratch', amount: 0 }),
    trade({ result: 'loss', amount: 100 }),
  ];
  it('sums net P&L', () => {
    expect(sumPnl(trades)).toBe(400 - 250 - 100);
  });
  it('separates cumulative wins and losses', () => {
    expect(cumulativeWins(trades)).toBe(400);
    expect(cumulativeLosses(trades)).toBe(350);
  });
  it('computes current balance and cushion', () => {
    expect(currentBalance(RULES, trades)).toBe(50000 + 50);
    // cushion = current balance - floor = 50050 - 48000
    expect(cushionRemaining(RULES, trades)).toBe(2050);
  });
});

describe('todayStats', () => {
  it('counts only trades on the given local day', () => {
    const now = new Date(2025, 5, 25, 10, 0);
    const trades = [
      trade({ result: 'loss', amount: 100, traded_at: new Date(2025, 5, 25, 9, 0).toISOString() }),
      trade({ result: 'win', amount: 200, traded_at: new Date(2025, 5, 25, 9, 30).toISOString() }),
      trade({ result: 'win', amount: 999, traded_at: new Date(2025, 5, 24, 9, 0).toISOString() }),
    ];
    const stats = todayStats(trades, now);
    expect(stats.tradeCount).toBe(2);
    expect(stats.pnl).toBe(100);
  });
});

describe('lockoutState', () => {
  const now = new Date(2025, 5, 25, 10, 0);
  const at = (h: number) => new Date(2025, 5, 25, h, 0).toISOString();

  it('does not lock under the limits', () => {
    const trades = [trade({ result: 'loss', amount: 100, traded_at: at(9) })];
    expect(lockoutState(RULES, trades, now).locked).toBe(false);
  });

  it('locks when the daily stop is hit exactly', () => {
    const trades = [trade({ result: 'loss', amount: 500, traded_at: at(9) })];
    const state = lockoutState(RULES, trades, now);
    expect(state.dailyStopHit).toBe(true);
    expect(state.locked).toBe(true);
  });

  it('locks when max trades reached', () => {
    const trades = [
      trade({ result: 'win', amount: 50, traded_at: at(9) }),
      trade({ result: 'win', amount: 50, traded_at: at(10) }),
    ];
    const state = lockoutState(RULES, trades, now);
    expect(state.maxTradesHit).toBe(true);
    expect(state.locked).toBe(true);
  });

  it('locks when the drawdown floor is breached even if daily limits are fine', () => {
    const lenient: Rules = { ...RULES, daily_stop_loss: 100000, max_trades_per_day: 100 };
    const trades = [trade({ result: 'loss', amount: 2000, traded_at: at(9) })];
    const state = lockoutState(lenient, trades, now);
    expect(state.floorBreached).toBe(true);
    expect(state.locked).toBe(true);
  });

  it('resets across days (yesterday losses do not lock today)', () => {
    const trades = [
      trade({ result: 'loss', amount: 500, traded_at: new Date(2025, 5, 24, 9, 0).toISOString() }),
    ];
    expect(lockoutState(RULES, trades, now).locked).toBe(false);
  });
});

describe('on-criteria vs impulse analytics', () => {
  const trades = [
    trade({ result: 'win', amount: 300, setup_criteria_met: true }),
    trade({ result: 'win', amount: 200, setup_criteria_met: true }),
    trade({ result: 'loss', amount: 150, setup_criteria_met: true }),
    trade({ result: 'loss', amount: 400, setup_criteria_met: false }),
    trade({ result: 'loss', amount: 300, setup_criteria_met: false }),
    trade({ result: 'win', amount: 100, setup_criteria_met: false }),
  ];

  it('splits trades by setup criteria', () => {
    expect(onCriteria(trades)).toHaveLength(3);
    expect(offCriteria(trades)).toHaveLength(3);
  });

  it('computes win rate from decisive trades only', () => {
    const on = groupStats(onCriteria(trades));
    expect(on.winRate).toBeCloseTo(2 / 3);
    expect(on.netPnl).toBe(300 + 200 - 150);

    const off = groupStats(offCriteria(trades));
    expect(off.winRate).toBeCloseTo(1 / 3);
    expect(off.netPnl).toBe(-400 - 300 + 100);
  });

  it('returns null win rate when there are no decisive trades', () => {
    const onlyScratch = [trade({ result: 'scratch', amount: 0 })];
    expect(groupStats(onlyScratch).winRate).toBeNull();
  });
});

describe('summarizeByDay', () => {
  it('groups, flags rule breaks, and sorts newest first', () => {
    const trades = [
      trade({ result: 'loss', amount: 300, traded_at: new Date(2025, 5, 24, 9, 0).toISOString() }),
      trade({ result: 'loss', amount: 300, traded_at: new Date(2025, 5, 24, 10, 0).toISOString() }),
      trade({ result: 'win', amount: 100, traded_at: new Date(2025, 5, 25, 9, 0).toISOString() }),
      trade({ result: 'win', amount: 100, traded_at: new Date(2025, 5, 25, 10, 0).toISOString() }),
      trade({ result: 'win', amount: 100, traded_at: new Date(2025, 5, 25, 11, 0).toISOString() }),
    ];
    const days = summarizeByDay(trades, RULES);
    expect(days.map((d) => d.key)).toEqual(['2025-06-25', '2025-06-24']);

    const [today, yesterday] = days;
    expect(today.tradeCount).toBe(3);
    expect(today.exceededMaxTrades).toBe(true); // 3 > 2
    expect(yesterday.netPnl).toBe(-600);
    expect(yesterday.hitDailyStop).toBe(true); // -600 <= -500
  });
});
