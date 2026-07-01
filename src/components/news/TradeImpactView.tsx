import { topTradeImpacts } from '../../lib/news/tradeImpact';
import type { NewsItem } from '../../lib/news/types';
import { formatTime } from '../../lib/format';

function sentimentClass(sentiment: NewsItem['sentiment']): string {
  if (sentiment === 'Bullish') return 'pos';
  if (sentiment === 'Bearish') return 'neg';
  return 'dim';
}

export function TradeImpactView({ items }: { items: NewsItem[] }) {
  const impacts = topTradeImpacts(items, 10);

  if (impacts.length === 0) {
    return <div className="empty">No high-importance stories to assess yet.</div>;
  }

  return (
    <div className="stack">
      {impacts.map((ti) => (
        <div className="card" key={ti.item.id}>
          <div className="news-card-head">
            <span className="num faint">{formatTime(ti.item.time)}</span>
            <span className={sentimentClass(ti.sentiment)}>
              {ti.sentiment} · {ti.confidence}% confidence
            </span>
          </div>
          <div className="news-card-headline">{ti.item.headline}</div>
          <div className="stack" style={{ marginTop: 10 }}>
            <div className="kv">
              <div className="k">Affected sectors</div>
              <div className="v">{ti.affectedSectors.join(', ')}</div>
            </div>
            <div className="kv">
              <div className="k">Potential volatility</div>
              <div className="v">{ti.volatility}</div>
            </div>
            <div className="kv">
              <div className="k">Trading ideas</div>
              <div className="v">
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {ti.opportunities.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
