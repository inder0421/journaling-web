import { formatTime } from '../../lib/format';
import type { NewsItem } from '../../lib/news/types';

function sentimentClass(sentiment: NewsItem['sentiment']): string {
  if (sentiment === 'Bullish') return 'pos';
  if (sentiment === 'Bearish') return 'neg';
  return 'dim';
}

function impactClass(impact: NewsItem['impact']): string {
  if (impact === 'High') return 'neg';
  if (impact === 'Medium') return 'warn';
  return 'dim';
}

export function NewsCard({ item }: { item: NewsItem }) {
  const body = (
    <>
      <div className="news-card-head">
        <span className="num faint">{formatTime(item.time)}</span>
        <span className="tag">{item.publisher ?? item.source}</span>
        {item.categories
          .filter((c) => c !== 'Market News')
          .slice(0, 2)
          .map((c) => (
            <span className="tag" key={c}>
              {c}
            </span>
          ))}
        {(item.tickers ?? []).slice(0, 4).map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>
      <div className="news-card-headline">{item.headline}</div>
      {item.aiSummary && item.aiSummary !== item.headline && (
        <div className="news-card-summary dim">{item.aiSummary}</div>
      )}
      <div className="news-card-foot">
        <span className={sentimentClass(item.sentiment)}>
          {item.sentiment} · {item.sentimentConfidence}%
        </span>
        <span className="dim">Importance {item.importance}/10</span>
        <span className={impactClass(item.impact)}>{item.impact} impact</span>
      </div>
    </>
  );

  return item.url ? (
    <a className="news-card" href={item.url} target="_blank" rel="noreferrer">
      {body}
    </a>
  ) : (
    <div className="news-card">{body}</div>
  );
}
