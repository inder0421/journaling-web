import { useState } from 'react';
import { useNews } from '../../lib/news/useNews';
import { SourceStatus } from './SourceStatus';
import { TodaysNews } from './TodaysNews';
import { ThisWeeksNews } from './ThisWeeksNews';
import { EconomicCalendar } from './EconomicCalendar';
import { CompanyNews } from './CompanyNews';
import { MarketBrief } from './MarketBrief';
import { TradeImpactView } from './TradeImpactView';
import { NewsAlerts } from './NewsAlerts';
import { DailyScoreView } from './DailyScoreView';

type SubTab = 'today' | 'week' | 'calendar' | 'company' | 'brief' | 'impact' | 'alerts' | 'score';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'today', label: "Today" },
  { key: 'week', label: 'This Week' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'company', label: 'Company' },
  { key: 'brief', label: 'AI Brief' },
  { key: 'impact', label: 'Trade Impact' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'score', label: 'Daily Score' },
];

export function NewsTab() {
  const news = useNews();
  const [sub, setSub] = useState<SubTab>('today');

  return (
    <div className="stack">
      <div className="news-subnav" role="tablist" aria-label="News sections">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            className={`tab${sub === t.key ? ' active' : ''}`}
            onClick={() => setSub(t.key)}
            aria-current={sub === t.key ? 'page' : undefined}
          >
            {t.label}
            {t.key === 'alerts' && news.alerts.length > 0 && <span className="tag" style={{ marginLeft: 6 }}>{news.alerts.length}</span>}
          </button>
        ))}
      </div>

      <div className="row-between">
        <span className="faint">
          {news.loading
            ? 'Loading news…'
            : news.lastUpdated
              ? `Updated ${news.lastUpdated.toLocaleTimeString()}`
              : 'Not yet loaded'}
        </span>
        <button className="btn btn-sm" onClick={() => void news.refresh()} disabled={news.refreshing}>
          {news.refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {news.error && (
        <div className="banner warn" role="alert">
          <div className="foot">{news.error}</div>
        </div>
      )}

      <SourceStatus statuses={news.sourceStatuses} />

      {sub === 'today' && <TodaysNews items={news.todaysItems} />}
      {sub === 'week' && <ThisWeeksNews items={news.weekItems} />}
      {sub === 'calendar' && (
        <EconomicCalendar today={news.calendarToday} tomorrow={news.calendarTomorrow} week={news.calendarWeek} />
      )}
      {sub === 'company' && (
        <CompanyNews watchlist={news.watchlist} setWatchlist={news.setWatchlist} companyItems={news.companyItems} />
      )}
      {sub === 'brief' && <MarketBrief items={news.todaysItems} score={news.dailyScore} />}
      {sub === 'impact' && <TradeImpactView items={news.todaysItems} />}
      {sub === 'alerts' && <NewsAlerts alerts={news.alerts} />}
      {sub === 'score' && <DailyScoreView score={news.dailyScore} />}
    </div>
  );
}
