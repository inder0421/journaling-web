import type { LockoutState } from '../lib/calculations';
import type { Rules } from '../lib/types';
import { money, moneySigned } from '../lib/format';

export function LockoutBanner({ lock, rules }: { lock: LockoutState; rules: Rules }) {
  if (!lock.locked) return null;

  const reasons: string[] = [];
  if (lock.dailyStopHit) {
    reasons.push(
      `Daily stop hit — today's P&L is ${moneySigned(lock.todayPnl)} (limit −${money(
        rules.daily_stop_loss,
      )}).`,
    );
  }
  if (lock.maxTradesHit) {
    reasons.push(
      `Trade limit reached — ${lock.todayCount} of ${rules.max_trades_per_day} taken today.`,
    );
  }
  if (lock.floorBreached) {
    reasons.push('Drawdown floor breached — there is no cushion left in the account.');
  }

  return (
    <div className="banner danger" role="alert">
      <h2>🔒 Trading locked for today</h2>
      <ul>
        {reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <div className="foot">
        The log is disabled. {lock.floorBreached ? 'Reassess the account before trading again.' : 'It resets at local midnight.'}{' '}
        Walk away — this is exactly the moment the rules exist for.
      </div>
    </div>
  );
}
