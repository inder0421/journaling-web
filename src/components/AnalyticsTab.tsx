import { useAppData } from '../context/AppData';
import {
  cumulativeLosses,
  cumulativeWins,
  currentBalance,
  cushionRemaining,
  groupStats,
  initialCushion,
  offCriteria,
  onCriteria,
  sumPnl,
  type GroupStats,
} from '../lib/calculations';
import { money, moneySigned, percent } from '../lib/format';

function CompareCard({
  kind,
  title,
  stats,
}: {
  kind: 'setup' | 'impulse';
  title: string;
  stats: GroupStats;
}) {
  const ratePct = stats.winRate === null ? 0 : Math.round(stats.winRate * 100);
  return (
    <div className={`compare-card ${kind}`}>
      <div className="head">{title}</div>

      <div className="compare-row">
        <span className="k">Win rate</span>
        <span className="v">{percent(stats.winRate)}</span>
      </div>
      <div className="bar-track">
        <div
          className={`bar-fill ${kind === 'setup' ? 'pos' : 'warn'}`}
          style={{ width: `${ratePct}%` }}
        />
      </div>

      <div className="compare-row">
        <span className="k">Net P&amp;L</span>
        <span className={`v ${stats.netPnl > 0 ? 'pos' : stats.netPnl < 0 ? 'neg' : ''}`}>
          {moneySigned(stats.netPnl)}
        </span>
      </div>
      <div className="compare-row">
        <span className="k">Trades</span>
        <span className="v">{stats.count}</span>
      </div>
      <div className="compare-row">
        <span className="k">W / L / S</span>
        <span className="v">
          {stats.wins} / {stats.losses} / {stats.scratches}
        </span>
      </div>
      <div className="compare-row">
        <span className="k">Avg / trade</span>
        <span className={`v ${(stats.avgPnl ?? 0) > 0 ? 'pos' : (stats.avgPnl ?? 0) < 0 ? 'neg' : ''}`}>
          {stats.avgPnl === null ? '—' : moneySigned(Math.round(stats.avgPnl))}
        </span>
      </div>
    </div>
  );
}

export function AnalyticsTab() {
  const { rules, trades } = useAppData();

  if (trades.length === 0) {
    return (
      <div className="card">
        <div className="empty">No trades logged yet. Your stats will appear here.</div>
      </div>
    );
  }

  const onStats = groupStats(onCriteria(trades));
  const offStats = groupStats(offCriteria(trades));
  const overall = groupStats(trades);

  const balance = currentBalance(rules, trades);
  const cushion = cushionRemaining(rules, trades);
  const startCushion = initialCushion(rules);
  const wins = cumulativeWins(trades);
  const losses = cumulativeLosses(trades);
  const net = sumPnl(trades);

  const cushionClass = cushion <= 0 ? 'neg' : startCushion > 0 && cushion <= startCushion * 0.25 ? 'warn' : 'pos';

  return (
    <div className="stack">
      <div>
        <div className="card-title" style={{ marginBottom: 10 }}>
          On-setup vs. impulse · all-time
        </div>
        <div className="compare">
          <CompareCard kind="setup" title="On-setup trades" stats={onStats} />
          <CompareCard kind="impulse" title="Impulse trades" stats={offStats} />
        </div>
      </div>

      {offStats.count > 0 && (
        <div className="card">
          <p className="callout">
            Your impulse trades win <strong>{percent(offStats.winRate)}</strong> of the time and have
            netted{' '}
            <strong className={offStats.netPnl < 0 ? 'neg' : offStats.netPnl > 0 ? 'pos' : ''}>
              {moneySigned(offStats.netPnl)}
            </strong>{' '}
            all-time, versus <strong>{percent(onStats.winRate)}</strong> and{' '}
            <strong className={onStats.netPnl < 0 ? 'neg' : onStats.netPnl > 0 ? 'pos' : ''}>
              {moneySigned(onStats.netPnl)}
            </strong>{' '}
            when you stayed on setup.
            {offStats.netPnl < 0 && onStats.netPnl > offStats.netPnl
              ? ' Every impulse trade is dragging the account down.'
              : ''}
          </p>
        </div>
      )}

      <div className="card">
        <div className="card-title">Account cushion</div>
        <div className="kv">
          <span className="k">Starting balance</span>
          <span className="v">{money(rules.starting_balance)}</span>
        </div>
        <div className="kv">
          <span className="k">Net P&amp;L (all-time)</span>
          <span className={`v ${net > 0 ? 'pos' : net < 0 ? 'neg' : ''}`}>{moneySigned(net)}</span>
        </div>
        <div className="kv">
          <span className="k">Current balance</span>
          <span className="v">{money(balance)}</span>
        </div>
        <div className="kv">
          <span className="k">Drawdown floor</span>
          <span className="v">{money(rules.max_drawdown_floor)}</span>
        </div>
        <div className="kv">
          <span className="k">Cushion remaining</span>
          <span className={`v ${cushionClass}`}>{money(cushion)}</span>
        </div>
        <div className="kv">
          <span className="k">Cumulative wins</span>
          <span className="v pos">{moneySigned(wins)}</span>
        </div>
        <div className="kv">
          <span className="k">Cumulative losses</span>
          <span className="v neg">{moneySigned(-losses)}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Overall</div>
        <div className="kv">
          <span className="k">Total trades</span>
          <span className="v">{overall.count}</span>
        </div>
        <div className="kv">
          <span className="k">Win rate</span>
          <span className="v">{percent(overall.winRate)}</span>
        </div>
        <div className="kv">
          <span className="k">Net P&amp;L</span>
          <span className={`v ${overall.netPnl > 0 ? 'pos' : overall.netPnl < 0 ? 'neg' : ''}`}>
            {moneySigned(overall.netPnl)}
          </span>
        </div>
        <div className="kv">
          <span className="k">Avg / trade</span>
          <span className="v">
            {overall.avgPnl === null ? '—' : moneySigned(Math.round(overall.avgPnl))}
          </span>
        </div>
      </div>
    </div>
  );
}
