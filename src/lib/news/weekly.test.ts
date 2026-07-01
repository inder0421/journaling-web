import { describe, it, expect } from 'vitest';
import { buildWeeklyGroups, sectorRotation, storyBreakdown } from './weekly';
import type { NewsItem } from './types';

function item(partial: Partial<NewsItem>): NewsItem {
  return {
    id: 'x',
    headline: 'Headline',
    source: 'Finnhub',
    time: new Date().toISOString(),
    categories: ['Market News'],
    sector: null,
    aiSummary: 'Headline',
    sentiment: 'Neutral',
    sentimentConfidence: 50,
    importance: 5,
    impact: 'Medium',
    ...partial,
  };
}

describe('buildWeeklyGroups', () => {
  it('marks groups without a data source as unavailable rather than empty-but-silent', () => {
    const groups = buildWeeklyGroups([]);
    const movers = groups.find((g) => g.key === 'movers');
    expect(movers?.unavailable).toBeTruthy();
    expect(movers?.items).toHaveLength(0);
  });

  it('routes Fed stories into the Federal Reserve group', () => {
    const groups = buildWeeklyGroups([item({ categories: ['Federal Reserve'], headline: 'Fed holds rates' })]);
    const fed = groups.find((g) => g.key === 'fed');
    expect(fed?.items).toHaveLength(1);
  });

  it('routes commodity keywords into the Commodities group', () => {
    const groups = buildWeeklyGroups([item({ headline: 'Crude oil prices jump on OPEC supply cut' })]);
    const commodities = groups.find((g) => g.key === 'commodities');
    expect(commodities?.items).toHaveLength(1);
  });
});

describe('sectorRotation', () => {
  it('tallies bullish/bearish/neutral counts per sector', () => {
    const rows = sectorRotation([
      item({ sector: 'Technology', sentiment: 'Bullish' }),
      item({ sector: 'Technology', sentiment: 'Bearish' }),
      item({ sector: 'Energy', sentiment: 'Bullish' }),
    ]);
    const tech = rows.find((r) => r.sector === 'Technology');
    const energy = rows.find((r) => r.sector === 'Energy');
    expect(tech).toEqual({ sector: 'Technology', bullish: 1, bearish: 1, neutral: 0 });
    expect(energy).toEqual({ sector: 'Energy', bullish: 1, bearish: 0, neutral: 0 });
  });
});

describe('storyBreakdown', () => {
  it('names bullish tickers as beneficiaries', () => {
    const result = storyBreakdown(item({ sentiment: 'Bullish', tickers: ['AAPL', 'MSFT'] }));
    expect(result.beneficiaries).toBe('AAPL, MSFT');
    expect(result.laggards).toContain('None flagged');
  });
});
