import { useState } from 'react';
import { useAppData } from '../context/AppData';
import { summarizeByDay, summarizeByWeek, type PeriodSummary } from '../lib/calculations';
import { formatDayKey, formatTime, money, moneySigned } from '../lib/format';
import type { Trade } from '../lib/types';

type View = 'daily' | 'weekly';

function TradeRow({ trade, onDelete }: { trade: Trade; onDelete: (id: string) => void }) {
  const pnlClass = trade.pnl > 0 ? 'pos' : trade.pnl < 0 ? 'neg' : 'faint';
  return (
    <div className="trade-row">
      <span className="t-time">{formatTime(trade.traded_at)}</span>
      <span className="t-instr">{trade.instrument}</span>
      <span className={`tag ${trade.setup_criteria_met ? 'setup' : 'impulse'}`}>
        {trade.setup_criteria_met ? 'setup' : 'impulse'}
      </span>
      <span className="t-reason">{trade.entry_reason || '—'}</span>
      <span className={`t-pnl ${pnlClass}`}>{moneySigned(trade.pnl)}</span>
      <button
        className="icon-btn"
        title="Delete trade"
        aria-label="Delete trade"
        onClick={() => {
          if (window.confirm('Delete this trade?')) onDelete(trade.id);
        }}
      >
        ✕
      </button>
    </div>
  );
}

function PeriodCard({
  summary,
  view,
  expanded,
  onToggle,
  onDelete,
}: {
  summary: PeriodSummary;
  view: View;
  expanded: boolean;
  onToggle: () => void;
  onDelete: (id: string) => void;
}) {
  const pnlClass = summary.netPnl > 0 ? 'pos' : summary.netPnl < 0 ? 'neg' : 'faint';
  const label = view === 'weekly' ? `Week of ${formatDayKey(summary.key)}` : formatDayKey(summary.key);

  return (
    <div className="day">
      <div className="day-head" onClick={onToggle}>
        <div>
          <div className="date">{label}</div>
          <div className="meta">
            {summary.tradeCount} {summary.tradeCount === 1 ? 'trade' : 'trades'} ·{' '}
            {summary.onCriteriaCount} on-setup · {summary.impulseCount} impulse
          </div>
        </div>
        <div className="right">
          <div className={`day-pnl ${pnlClass}`}>{moneySigned(summary.netPnl)}</div>
          <div className="flags">
            {summary.hitDailyStop && <span className="flag">stop hit</span>}
            {summary.exceededMaxTrades && <span className="flag">over limit</span>}
            {summary.impulseCount > 0 && (
              <span className="flag" style={{ background: 'var(--warn-bg)', color: 'var(--warn)', borderColor: 'rgba(207,154,77,0.4)' }}>
                {summary.impulseCount} impulse
              </span>
            )}
          </div>
        </div>
      </div>
      {expanded &&
        summary.trades
          .slice()
          .reverse()
          .map((t) => <TradeRow key={t.id} trade={t} onDelete={onDelete} />)}
    </div>
  );
}

export function HistoryTab() {
  const { trades, deleteTrade, rules } = useAppData();
  const [view, setView] = useState<View>('daily');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (trades.length === 0) {
    return (
      <div className="card">
        <div className="empty">No history yet. Logged trades will show up here, grouped by day.</div>
      </div>
    );
  }

  const summaries = view === 'daily' ? summarizeByDay(trades, rules) : summarizeByWeek(trades, rules);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const total = trades.reduce((s, t) => s + t.pnl, 0);

  return (
    <div className="stack">
      <div className="row-between">
        <div className="seg" style={{ display: 'inline-grid', gridAutoColumns: 'auto' }}>
          <button
            className={`choice btn-sm${view === 'daily' ? ' sel sel-neutral' : ''}`}
            onClick={() => setView('daily')}
          >
            Daily
          </button>
          <button
            className={`choice btn-sm${view === 'weekly' ? ' sel sel-neutral' : ''}`}
            onClick={() => setView('weekly')}
          >
            Weekly
          </button>
        </div>
        <div className="faint" style={{ fontSize: 13 }}>
          {trades.length} trades · net{' '}
          <span className={`num ${total > 0 ? 'pos' : total < 0 ? 'neg' : ''}`}>
            {moneySigned(total)}
          </span>
        </div>
      </div>

      <div>
        {summaries.map((s) => (
          <PeriodCard
            key={s.key}
            summary={s}
            view={view}
            expanded={expanded.has(s.key)}
            onToggle={() => toggle(s.key)}
            onDelete={(id) => void deleteTrade(id)}
          />
        ))}
      </div>

      <div className="muted-block" style={{ textAlign: 'center' }}>
        Floor {money(rules.max_drawdown_floor)} · max {rules.max_trades_per_day}/day · stop −
        {money(rules.daily_stop_loss)}
      </div>
    </div>
  );
}
