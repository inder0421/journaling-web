import { useState } from 'react';
import { buildWeeklyGroups, sectorRotation, storyBreakdown } from '../../lib/news/weekly';
import type { NewsItem } from '../../lib/news/types';
import { NewsCard } from './NewsCard';

function StoryDetail({ item }: { item: NewsItem }) {
  const b = storyBreakdown(item);
  return (
    <div className="stack" style={{ marginTop: 8 }}>
      <NewsCard item={item} />
      <div className="kv" style={{ fontSize: 13 }}>
        <div className="k">Why it matters</div>
        <div className="v">{b.why}</div>
      </div>
      <div className="kv" style={{ fontSize: 13 }}>
        <div className="k">Sectors affected</div>
        <div className="v">{b.sectors}</div>
      </div>
      <div className="kv" style={{ fontSize: 13 }}>
        <div className="k">Could benefit</div>
        <div className="v pos">{b.beneficiaries}</div>
      </div>
      <div className="kv" style={{ fontSize: 13 }}>
        <div className="k">Could be hurt</div>
        <div className="v neg">{b.laggards}</div>
      </div>
    </div>
  );
}

export function ThisWeeksNews({ items }: { items: NewsItem[] }) {
  const groups = buildWeeklyGroups(items);
  const rotation = sectorRotation(items);
  const [openKey, setOpenKey] = useState<string | null>(null);

  if (items.length === 0) {
    return <div className="empty">No stories from the last 7 days yet.</div>;
  }

  return (
    <div className="stack">
      {groups.map((group) => (
        <div className="card" key={group.key}>
          <div className="card-title">{group.label}</div>
          {group.unavailable ? (
            <div className="empty">{group.unavailable}</div>
          ) : group.items.length === 0 ? (
            <div className="empty">Nothing this week.</div>
          ) : group.key === 'sector-rotation' ? (
            <div className="stack">
              {rotation.map((r) => (
                <div className="kv" key={r.sector}>
                  <div className="k">{r.sector}</div>
                  <div className="v">
                    <span className="pos">{r.bullish} bullish</span> · <span className="neg">{r.bearish} bearish</span> ·{' '}
                    <span className="dim">{r.neutral} neutral</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="stack">
              {group.items.map((item) => (
                <div key={item.id}>
                  <button
                    className="news-group-head"
                    onClick={() => setOpenKey((k) => (k === item.id ? null : item.id))}
                  >
                    <span style={{ textAlign: 'left' }}>{item.headline}</span>
                    <span className="faint">{openKey === item.id ? '▾' : '▸'}</span>
                  </button>
                  {openKey === item.id && <StoryDetail item={item} />}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
