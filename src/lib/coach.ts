import { Rules, Trade } from "./types";
import {
  accountCushion,
  criteriaSplit,
  groupByDay,
  noTradeCount,
  takenTrades,
} from "./calc";
import { money, pct, signedMoney } from "./format";

export type InsightTone = "good" | "warn" | "bad" | "info";

export interface Insight {
  tone: InsightTone;
  text: string;
}

const ORDER: Record<InsightTone, number> = { bad: 0, warn: 1, good: 2, info: 3 };

/**
 * A rule-based "coach". It reads the same numbers the dashboard shows and
 * turns them into plain, specific feedback — what's working, what's leaking,
 * and where the risk is. No external AI, no streaks or gamification; just the
 * trader's own data reflected back with a recommendation.
 */
export function coachInsights(
  trades: Trade[],
  rules: Rules,
  now: Date = new Date()
): Insight[] {
  const out: Insight[] = [];
  const taken = takenTrades(trades);
  const noTrades = noTradeCount(trades);

  if (taken.length === 0 && noTrades === 0) {
    return [
      {
        tone: "info",
        text: "No trades logged yet. The coach sharpens as you log — your on-setup vs. impulse split is where it starts.",
      },
    ];
  }

  const { onCriteria, offCriteria } = criteriaSplit(trades);
  const cushion = accountCushion(trades, rules);
  const allowance = Math.max(
    0,
    rules.starting_balance - rules.max_drawdown_floor
  );

  // 1. Impulse damage — the central problem.
  if (offCriteria.trades > 0) {
    if (offCriteria.netPnl < 0) {
      out.push({
        tone: "bad",
        text: `Impulse trades have cost you ${money(
          Math.abs(offCriteria.netPnl)
        )} over ${offCriteria.trades} trade${
          offCriteria.trades === 1 ? "" : "s"
        } (${pct(
          offCriteria.winRate
        )} win rate). This is your leak — every off-setup trade you skip is money kept.`,
      });
    } else {
      out.push({
        tone: "warn",
        text: `Your impulse trades are net positive for now (${signedMoney(
          offCriteria.netPnl
        )}), but ${offCriteria.trades} off-setup trade${
          offCriteria.trades === 1 ? " is" : "s are"
        } still rule-breaking. Don't let a lucky run convince you it works.`,
      });
    }
  }

  // 2. On-setup is working.
  if (onCriteria.trades >= 3 && onCriteria.netPnl > 0) {
    out.push({
      tone: "good",
      text: `On-setup trades are working: ${signedMoney(
        onCriteria.netPnl
      )} at ${pct(onCriteria.winRate)} across ${
        onCriteria.trades
      }. When you follow the plan, you make money — do more of exactly this.`,
    });
  }

  // 3. Win-rate gap (the case for discipline, in their own numbers).
  if (
    onCriteria.winRate !== null &&
    offCriteria.winRate !== null &&
    onCriteria.winRate - offCriteria.winRate >= 0.1
  ) {
    out.push({
      tone: "info",
      text: `On-setup win rate is ${pct(onCriteria.winRate)} vs ${pct(
        offCriteria.winRate
      )} on impulse. That gap is the whole argument for waiting for your setup.`,
    });
  }

  // 4. Restraint — reward logged no-trades.
  if (noTrades > 0) {
    out.push({
      tone: "good",
      text: `You logged ${noTrades} no-trade${
        noTrades === 1 ? "" : "s"
      } — that's restraint. Walking away from a weak setup is a skill; keep counting these.`,
    });
  }

  // 5. Rule discipline across days (cap breaks / stop overruns).
  const days = groupByDay(trades);
  let capBreaks = 0;
  let stopOverruns = 0;
  for (const d of days) {
    if (rules.max_trades_per_day > 0 && d.takenCount > rules.max_trades_per_day) {
      capBreaks++;
    }
    if (rules.daily_stop_loss > 0 && d.pnl < -rules.daily_stop_loss) {
      stopOverruns++;
    }
  }
  if (capBreaks > 0) {
    out.push({
      tone: "bad",
      text: `You went over your ${rules.max_trades_per_day}-trade limit on ${capBreaks} day${
        capBreaks === 1 ? "" : "s"
      }. The cap only protects you if you actually stop when you hit it.`,
    });
  }
  if (stopOverruns > 0) {
    out.push({
      tone: "bad",
      text: `You pushed past your ${money(
        rules.daily_stop_loss
      )} daily stop on ${stopOverruns} day${
        stopOverruns === 1 ? "" : "s"
      }. The stop is the floor, not a target to lean on.`,
    });
  }
  if (
    capBreaks === 0 &&
    stopOverruns === 0 &&
    days.length >= 3 &&
    (rules.max_trades_per_day > 0 || rules.daily_stop_loss > 0)
  ) {
    out.push({
      tone: "good",
      text: `No blown stops and no over-limit days across ${days.length} sessions. That consistency is the entire game — protect the streak.`,
    });
  }

  // 6. Cushion risk.
  if (allowance > 0) {
    const ratio = cushion / allowance;
    if (cushion <= 0) {
      out.push({
        tone: "bad",
        text: `Your cushion is gone — you're at or past your drawdown floor. Stop trading and reset before the account is blown.`,
      });
    } else if (ratio < 0.25) {
      out.push({
        tone: "warn",
        text: `Only ${money(
          cushion
        )} of cushion left before your floor. Size down and protect what's left — one bad day ends it.`,
      });
    }
  }

  // 7. Thin sample — temper conclusions.
  if (taken.length > 0 && taken.length < 5) {
    out.push({
      tone: "info",
      text: `Only ${taken.length} trade${
        taken.length === 1 ? "" : "s"
      } logged so far — patterns get reliable past ~15. Keep logging every trade, on-setup or not.`,
    });
  }

  out.sort((a, b) => ORDER[a.tone] - ORDER[b.tone]);
  return out.slice(0, 5);
}
