/** Template-driven synthesis of the Morning Brief / Midday Update / Closing Summary. */
import type { DailyScore, NewsItem, Sentiment } from './types';
import { topByImportance } from './aggregator';

export type BriefKind = 'morning' | 'midday' | 'closing';

const KIND_LEAD: Record<BriefKind, string> = {
  morning: 'Markets are heading into the open',
  midday: 'Midday, markets are trading',
  closing: 'Markets closed',
};

function sentimentTone(label: DailyScore['label']): string {
  switch (label) {
    case 'Very Bullish':
      return 'sharply higher, led by broad risk-on positioning';
    case 'Bullish':
      return 'modestly higher';
    case 'Neutral':
      return 'mixed, lacking a clear catalyst';
    case 'Bearish':
      return 'modestly lower';
    case 'Very Bearish':
      return 'sharply lower amid broad risk-off positioning';
  }
}

function sectorSentence(items: NewsItem[]): string | null {
  const bySector = new Map<string, { pos: number; neg: number }>();
  for (const item of items) {
    if (!item.sector) continue;
    const bucket = bySector.get(item.sector) ?? { pos: 0, neg: 0 };
    if (item.sentiment === 'Bullish') bucket.pos += 1;
    if (item.sentiment === 'Bearish') bucket.neg += 1;
    bySector.set(item.sector, bucket);
  }
  const ranked = Array.from(bySector.entries()).sort((a, b) => b[1].pos - b[1].neg - (a[1].pos - a[1].neg));
  const leader = ranked[0];
  const laggard = ranked[ranked.length - 1];
  if (!leader) return null;
  if (leader === laggard || ranked.length === 1) return `${leader[0]} is in focus on today's news flow.`;
  return `${leader[0]} leads on today's headlines, while ${laggard[0]} lags.`;
}

function topStorySentence(items: NewsItem[]): string | null {
  const top = topByImportance(items, 1)[0];
  if (!top) return null;
  return `The story to watch: "${top.headline}" (${top.sentiment.toLowerCase()}, importance ${top.importance}/10).`;
}

function catalystSentence(items: NewsItem[]): string | null {
  const fedOrData = items.find((i) => i.categories.some((c) => ['Federal Reserve', 'Inflation', 'Employment', 'Interest Rates'].includes(c)));
  if (!fedOrData) return null;
  return `Investors remain focused on ${fedOrData.headline.toLowerCase()}.`;
}

/** Builds the "Markets are expected to open higher following..." style paragraph. */
export function generateBrief(kind: BriefKind, items: NewsItem[], score: DailyScore): string {
  const parts: string[] = [];
  parts.push(`${KIND_LEAD[kind]} ${sentimentTone(score.label)}.`);

  const sector = sectorSentence(items);
  if (sector) parts.push(sector);

  const top = topStorySentence(items);
  if (top) parts.push(top);

  const catalyst = catalystSentence(items);
  if (catalyst) parts.push(catalyst);

  return parts.join(' ');
}

export function dominantSentiment(items: NewsItem[]): Sentiment {
  const bull = items.filter((i) => i.sentiment === 'Bullish').length;
  const bear = items.filter((i) => i.sentiment === 'Bearish').length;
  if (bull > bear) return 'Bullish';
  if (bear > bull) return 'Bearish';
  return 'Neutral';
}
