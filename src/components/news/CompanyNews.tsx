import { useState } from 'react';
import type { NewsItem } from '../../lib/news/types';
import { NewsCard } from './NewsCard';

const FILING_CATEGORY_RE = /8-K|10-Q|10-K/i;

export function CompanyNews({
  watchlist,
  setWatchlist,
  companyItems,
}: {
  watchlist: string[];
  setWatchlist: (tickers: string[]) => void;
  companyItems: (ticker: string) => NewsItem[];
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const t = draft.trim().toUpperCase();
    if (!t) return;
    if (!watchlist.includes(t)) setWatchlist([...watchlist, t]);
    setDraft('');
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-title">Watchlist</div>
        <div className="news-watchlist-add">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Add ticker, e.g. AAPL"
            aria-label="Add ticker"
          />
          <button className="btn btn-sm" onClick={add}>
            Add
          </button>
        </div>
        <div className="news-watchlist-tags">
          {watchlist.map((t) => (
            <span className="tag" key={t}>
              {t}
              <button
                className="icon-btn"
                aria-label={`Remove ${t}`}
                onClick={() => setWatchlist(watchlist.filter((x) => x !== t))}
              >
                ×
              </button>
            </span>
          ))}
          {watchlist.length === 0 && <span className="faint">No tickers tracked yet.</span>}
        </div>
      </div>

      {watchlist.map((ticker) => {
        const items = companyItems(ticker);
        const filings = items.filter((i) => i.source === 'SEC EDGAR' || FILING_CATEGORY_RE.test(i.headline));
        const news = items.filter((i) => !filings.includes(i));
        return (
          <div className="card" key={ticker}>
            <div className="card-title">{ticker}</div>
            {items.length === 0 ? (
              <div className="empty">No recent news or filings.</div>
            ) : (
              <div className="stack">
                {news.map((item) => (
                  <NewsCard key={item.id} item={item} />
                ))}
                {filings.map((item) => (
                  <NewsCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
