"use client";

import { LockoutState } from "@/lib/calc";
import { Rules } from "@/lib/types";
import { money } from "@/lib/format";

export default function LockoutBanner({
  lock,
  rules,
}: {
  lock: LockoutState;
  rules: Rules;
}) {
  const reasons: string[] = [];
  if (lock.stopHit) {
    reasons.push(
      `Daily stop hit — down ${money(Math.abs(lock.dailyPnl))} against your ${money(
        rules.daily_stop_loss
      )} stop.`
    );
  }
  if (lock.maxTradesHit) {
    reasons.push(
      `Max trades reached — ${lock.count} of ${rules.max_trades_per_day} taken today.`
    );
  }

  return (
    <div
      role="alert"
      className="rounded-lg border border-danger bg-danger/15 p-4"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-danger text-danger"
        >
          {/* lock glyph */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <rect
              x="4"
              y="10"
              width="16"
              height="11"
              rx="2"
              stroke="currentColor"
              strokeWidth="2.2"
            />
            <path
              d="M8 10V7a4 4 0 0 1 8 0v3"
              stroke="currentColor"
              strokeWidth="2.2"
            />
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold text-danger">
            Trading locked for today
          </p>
          <ul className="mt-1 space-y-0.5 text-sm text-fg/90">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Logging is disabled until tomorrow. This is the rule you set for
            yourself. Step away from the screen.
          </p>
        </div>
      </div>
    </div>
  );
}
