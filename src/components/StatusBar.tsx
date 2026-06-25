import { useAppData } from '../context/AppData';
import {
  cushionRemaining,
  currentBalance,
  initialCushion,
  todayStats,
} from '../lib/calculations';
import { money, moneySigned } from '../lib/format';

export function StatusBar() {
  const { rules, trades } = useAppData();

  const { pnl: todayPnl, tradeCount } = todayStats(trades);
  const cushion = cushionRemaining(rules, trades);
  const balance = currentBalance(rules, trades);
  const startCushion = initialCushion(rules);

  const pnlClass = todayPnl > 0 ? 'pos' : todayPnl < 0 ? 'neg' : '';
  const stopProximity = rules.daily_stop_loss > 0 && todayPnl <= -rules.daily_stop_loss;

  const tradesAtLimit = rules.max_trades_per_day > 0 && tradeCount >= rules.max_trades_per_day;

  const cushionLow = startCushion > 0 && cushion <= startCushion * 0.25;
  const cushionClass = cushion <= 0 ? 'neg' : cushionLow ? 'warn' : 'pos';

  return (
    <div className="stat-grid">
      <div className={`stat${stopProximity ? ' accent-neg' : ''}`}>
        <div className="label">Today&rsquo;s P&amp;L</div>
        <div className={`value ${pnlClass}`}>{moneySigned(todayPnl)}</div>
        <div className="meta">stop at &minus;{money(rules.daily_stop_loss)}</div>
      </div>

      <div className={`stat${tradesAtLimit ? ' accent-warn' : ''}`}>
        <div className="label">Trades today</div>
        <div className={`value${tradesAtLimit ? ' warn' : ''}`}>
          {tradeCount}
          <span className="faint" style={{ fontSize: 18 }}>
            {' '}
            / {rules.max_trades_per_day}
          </span>
        </div>
        <div className="meta">max {rules.max_trades_per_day}/day</div>
      </div>

      <div className={`stat${cushion <= 0 ? ' accent-neg' : cushionLow ? ' accent-warn' : ''}`}>
        <div className="label">Cushion left</div>
        <div className={`value ${cushionClass}`}>{money(cushion)}</div>
        <div className="meta">to floor {money(rules.max_drawdown_floor)}</div>
      </div>

      <div className="stat">
        <div className="label">Balance</div>
        <div className="value">{money(balance)}</div>
        <div className="meta">started {money(rules.starting_balance)}</div>
      </div>
    </div>
  );
}
