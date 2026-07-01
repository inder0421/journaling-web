import { useState } from 'react';
import { groupByCategory } from '../../lib/news/aggregator';
import { NEWS_CATEGORIES } from '../../lib/news/types';
import type { NewsItem } from '../../lib/news/types';
import { NewsCard } from './NewsCard';

export function TodaysNews({ items }: { items: NewsItem[] }) {
  const grouped = groupByCategory(items);
  const [open, setOpen] = useState<Set<string>>(new Set(['Market News']));

  const toggle = (cat: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });

  if (items.length === 0) {
    return <div className="empty">No stories yet today — check back soon, or trigger a refresh above.</div>;
  }

  return (
    <div className="stack">
      {NEWS_CATEGORIES.map((cat) => {
        const bucket = grouped.get(cat);
        if (!bucket || bucket.length === 0) return null;
        const sorted = [...bucket].sort((a, b) => b.importance - a.importance);
        const isOpen = open.has(cat);
        return (
          <div className="card" key={cat}>
            <button className="news-group-head" onClick={() => toggle(cat)} aria-expanded={isOpen}>
              <span className="card-title" style={{ marginBottom: 0 }}>
                {cat}
              </span>
              <span className="faint">
                {bucket.length} {isOpen ? '▾' : '▸'}
              </span>
            </button>
            {isOpen && (
              <div className="stack news-group-body">
                {sorted.map((item) => (
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
