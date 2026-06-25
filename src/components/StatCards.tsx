"use client";

import { LockoutState } from "@/lib/calc";
import { Rules } from "@/lib/types";
import { money, signedMoney } from "@/lib/format";

function pnlColor(n: number): string {
  if (n > 0) return "text-win";
  if (n < 0) return "text-loss";
  return "text-scratch";
}

export default function StatCards({
  dailyPnl,
  cushion,
  balance,
  lock,
  rules,
}: {
  dailyPnl: number;
  cushion: number;
  balance: number;
  lock: LockoutState;
  rules: Rules;
}) {
  const allowance = Math.max(0, rules.starting_balance - rules.max_drawdown_floor);
  const cushionRatio = allowance > 0 ? Math.max(0, Math.min(1, cushion / allowance)) : 0;
  const barColor =
    cushionRatio > 0.5
      ? "bg-win"
      : cushionRatio > 0.2
        ? "bg-warn"
        : "bg-danger";

  return (
    <div className="space-y-3">
      {/* Cushion — the headline safety number */}
      <div className="rounded-lg border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Account cushion
          </span>
          <span className="text-xs text-faint">
            room of {money(allowance)} allowed
          </span>
        </div>
        <div
          className={`mt-1 text-3xl font-semibold tnum ${
            cushion <= 0 ? "text-danger" : "text-fg"
          }`}
        >
          {money(cushion)}
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full rounded-full ${barColor} transition-[width]`}
            style={{ width: `${cushionRatio * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-faint">
          (Starting {money(rules.starting_balance)} − floor{" "}
          {money(rules.max_drawdown_floor)}) − cumulative losses. At $0 the
          account is blown.
        </p>
      </div>

      {/* Today's P&L + live balance */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-line bg-surface p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">
            Today&apos;s P&amp;L
          </div>
          <div className={`mt-1 text-2xl font-semibold tnum ${pnlColor(dailyPnl)}`}>
            {signedMoney(dailyPnl)}
          </div>
          <div className="mt-1 text-xs text-faint">
            {lock.lossRoomRemaining === Infinity
              ? "no daily stop set"
              : `${money(lock.lossRoomRemaining)} loss room left`}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-surface p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">
            Balance
          </div>
          <div className="mt-1 text-2xl font-semibold tnum text-fg">
            {money(balance)}
          </div>
          <div className="mt-1 text-xs text-faint">
            {lock.tradesRemaining === Infinity
              ? `${lock.count} today`
              : `${lock.tradesRemaining} of ${rules.max_trades_per_day} trades left`}
          </div>
        </div>
      </div>
    </div>
  );
}
