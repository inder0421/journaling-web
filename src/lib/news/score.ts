/**
 * Daily News Score (0-100): sentiment-weighted rollup of today's stories.
 * We don't have a live market-data feed wired up (VIX/yields/DXY/breadth), so those
 * factors are omitted rather than faked — the "factors" list only shows what actually
 * fed the score, which keeps the number honest.
 */
import type { DailyScore, NewsItem } from './types';

function sentimentValue(item: NewsItem): number {
  const dir = item.sentiment === 'Bullish' ? 1 : item.sentiment === 'Bearish' ? -1 : 0;
  return dir * (item.importance / 10) * (item.sentimentConfidence / 100);
}

function labelFor(score: number): DailyScore['label'] {
  if (score >= 80) return 'Very Bullish';
  if (score >= 60) return 'Bullish';
  if (score > 40) return 'Neutral';
  if (score > 20) return 'Bearish';
  return 'Very Bearish';
}

export function computeDailyScore(todaysItems: NewsItem[]): DailyScore {
  if (todaysItems.length === 0) {
    return { score: 50, label: 'Neutral', factors: [{ label: 'News volume', value: 'No stories yet today', contribution: 0 }] };
  }

  const avg = todaysItems.reduce((sum, i) => sum + sentimentValue(i), 0) / todaysItems.length;
  const score = Math.round(Math.max(0, Math.min(100, 50 + avg * 50)));

  const bullish = todaysItems.filter((i) => i.sentiment === 'Bullish').length;
  const bearish = todaysItems.filter((i) => i.sentiment === 'Bearish').length;
  const neutral = todaysItems.length - bullish - bearish;
  const highImportance = todaysItems.filter((i) => i.importance >= 8).length;

  return {
    score,
    label: labelFor(score),
    factors: [
      { label: 'Corporate & market news sentiment', value: `${bullish} bullish / ${bearish} bearish / ${neutral} neutral`, contribution: Math.round(avg * 50) },
      { label: 'High-importance stories today', value: String(highImportance), contribution: highImportance > 0 ? Math.min(10, highImportance * 2) : 0 },
      { label: 'Stories analyzed', value: String(todaysItems.length), contribution: 0 },
    ],
  };
}
