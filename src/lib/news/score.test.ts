import { describe, it, expect } from 'vitest';
import { computeDailyScore } from './score';
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

describe('computeDailyScore', () => {
  it('returns a neutral score with no stories', () => {
    const result = computeDailyScore([]);
    expect(result.score).toBe(50);
    expect(result.label).toBe('Neutral');
  });

  it('scores above 50 when bullish stories dominate', () => {
    const result = computeDailyScore([
      item({ sentiment: 'Bullish', sentimentConfidence: 90, importance: 9 }),
      item({ sentiment: 'Bullish', sentimentConfidence: 80, importance: 8 }),
    ]);
    expect(result.score).toBeGreaterThan(50);
    expect(['Bullish', 'Very Bullish']).toContain(result.label);
  });

  it('scores below 50 when bearish stories dominate', () => {
    const result = computeDailyScore([
      item({ sentiment: 'Bearish', sentimentConfidence: 90, importance: 9 }),
      item({ sentiment: 'Bearish', sentimentConfidence: 80, importance: 8 }),
    ]);
    expect(result.score).toBeLessThan(50);
    expect(['Bearish', 'Very Bearish']).toContain(result.label);
  });

  it('clamps score to [0, 100]', () => {
    const many = Array.from({ length: 20 }, () => item({ sentiment: 'Bearish', sentimentConfidence: 100, importance: 10 }));
    const result = computeDailyScore(many);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
