import { useMemo, useState } from 'react';
import { generateBrief, type BriefKind } from '../../lib/news/brief';
import type { DailyScore, NewsItem } from '../../lib/news/types';

const KIND_LABEL: Record<BriefKind, string> = {
  morning: 'Morning Brief',
  midday: 'Midday Update',
  closing: 'Closing Summary',
};

function defaultKind(): BriefKind {
  const hour = new Date().getHours();
  if (hour < 11) return 'morning';
  if (hour < 15) return 'midday';
  return 'closing';
}

export function MarketBrief({ items, score }: { items: NewsItem[]; score: DailyScore }) {
  const [kind, setKind] = useState<BriefKind>(defaultKind);
  const brief = useMemo(() => generateBrief(kind, items, score), [kind, items, score]);

  return (
    <div className="card">
      <div className="seg" role="tablist" aria-label="Brief">
        {(Object.keys(KIND_LABEL) as BriefKind[]).map((k) => (
          <button key={k} className={`choice${kind === k ? ' sel' : ''}`} onClick={() => setKind(k)}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <p style={{ marginTop: 14, lineHeight: 1.6 }}>{brief}</p>
    </div>
  );
}
