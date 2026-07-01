import { describe, it, expect } from 'vitest';
import { aggregate, groupByCategory, topByImportance, withinHours } from './aggregator';
import type { SourceResult } from './sources';
import type { RawNewsItem } from './types';

function raw(partial: Partial<RawNewsItem> & { id: string; headline: string; time: string }): RawNewsItem {
  return { source: 'Finnhub', ...partial };
}

function results(items: RawNewsItem[]): SourceResult[] {
  return [{ source: 'Finnhub', configured: true, ok: true, items }];
}

describe('aggregate', () => {
  it('dedupes stories that share a URL across sources', () => {
    const items = aggregate([
      results([raw({ id: 'a', headline: 'Fed holds rates', url: 'https://x.test/1', time: new Date().toISOString() })])[0],
      { source: 'Yahoo Finance', configured: true, ok: true, items: [raw({ id: 'b', headline: 'Fed holds rates', url: 'https://x.test/1', time: new Date().toISOString() })] },
    ]);
    expect(items).toHaveLength(1);
  });

  it('dedupes by normalized headline when there is no URL', () => {
    const items = aggregate(results([
      raw({ id: 'a', headline: 'Fed Holds Rates!', time: new Date().toISOString() }),
      raw({ id: 'b', headline: 'fed holds rates', time: new Date().toISOString() }),
    ]));
    expect(items).toHaveLength(1);
  });

  it('sorts newest first and enriches with sentiment/importance/impact', () => {
    const older = new Date(Date.now() - 3600_000).toISOString();
    const newer = new Date().toISOString();
    const items = aggregate(results([
      raw({ id: 'a', headline: 'Old story', time: older }),
      raw({ id: 'b', headline: 'Federal Reserve raises interest rates', time: newer }),
    ]));
    expect(items[0].headline).toBe('Federal Reserve raises interest rates');
    expect(items[0].categories).toContain('Federal Reserve');
    expect(items[0].importance).toBeGreaterThanOrEqual(1);
    expect(['Bullish', 'Bearish', 'Neutral']).toContain(items[0].sentiment);
  });
});

describe('withinHours', () => {
  it('filters out stories older than the window', () => {
    const items = aggregate(results([
      raw({ id: 'a', headline: 'Recent', time: new Date().toISOString() }),
      raw({ id: 'b', headline: 'Old', time: new Date(Date.now() - 48 * 3600_000).toISOString() }),
    ]));
    expect(withinHours(items, 24)).toHaveLength(1);
  });
});

describe('groupByCategory', () => {
  it('places a story in every category it matches', () => {
    const items = aggregate(results([
      raw({ id: 'a', headline: 'Federal Reserve signals higher interest rates ahead', time: new Date().toISOString() }),
    ]));
    const grouped = groupByCategory(items);
    expect(grouped.get('Federal Reserve')?.length).toBe(1);
    expect(grouped.get('Interest Rates')?.length).toBe(1);
  });
});

describe('topByImportance', () => {
  it('returns the highest-importance stories first, capped at n', () => {
    const items = aggregate(results([
      raw({ id: 'a', headline: 'Company announces new office', time: new Date().toISOString() }),
      raw({ id: 'b', headline: 'Federal Reserve raises interest rates sharply', time: new Date().toISOString() }),
    ]));
    const top = topByImportance(items, 1);
    expect(top).toHaveLength(1);
    expect(top[0].headline).toContain('Federal Reserve');
  });
});
