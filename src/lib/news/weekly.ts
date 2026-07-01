/**
 * "This Week's News" uses a different grouping than "Today's News" (per spec) — some
 * buckets (Largest Stock Movers, Global Markets) need a live quotes/international feed
 * we don't have wired up, so those groups say so plainly instead of showing fake rows.
 */
import type { NewsItem } from './types';
import { topByImportance } from './aggregator';

export interface WeeklyGroup {
  key: string;
  label: string;
  items: NewsItem[];
  unavailable?: string;
}

const COMMODITY_RE = /\b(crude|oil|gold|silver|natural gas|opec|barrel|copper|wheat|commodit)/i;
const POLICY_RE = /\b(congress|white house|tariff|regulation|regulatory|policy|treasury department|antitrust|legislation|executive order|sanction)/i;
const GEOPOLITICAL_RE = /\b(war|conflict|sanctions|geopolitical|invasion|ceasefire|trade war|military)/i;

export function buildWeeklyGroups(weekItems: NewsItem[]): WeeklyGroup[] {
  const has = (re: RegExp) => (i: NewsItem) => re.test(`${i.headline} ${i.summary ?? ''}`);

  return [
    { key: 'top-market', label: 'Top Market Stories', items: topByImportance(weekItems.filter((i) => i.categories.includes('Market News')), 8) },
    {
      key: 'top-economic',
      label: 'Top Economic Events',
      items: topByImportance(weekItems.filter((i) => i.categories.some((c) => ['Economic News', 'Inflation', 'Employment', 'Interest Rates'].includes(c))), 8),
    },
    { key: 'fed', label: 'Federal Reserve', items: topByImportance(weekItems.filter((i) => i.categories.includes('Federal Reserve')), 6) },
    { key: 'earnings', label: 'Major Earnings', items: topByImportance(weekItems.filter((i) => i.categories.includes('Earnings')), 8) },
    {
      key: 'movers',
      label: 'Largest Stock Movers',
      items: [],
      unavailable: 'Requires a live quotes feed (not configured) — connect Finnhub/FMP to enable.',
    },
    { key: 'sector-rotation', label: 'Sector Rotation', items: topByImportance(weekItems.filter((i) => i.sector), 10) },
    { key: 'commodities', label: 'Commodities', items: topByImportance(weekItems.filter(has(COMMODITY_RE)), 6) },
    { key: 'crypto', label: 'Crypto', items: topByImportance(weekItems.filter((i) => i.categories.includes('Crypto')), 6) },
    {
      key: 'global',
      label: 'Global Markets',
      items: [],
      unavailable: 'Requires an international markets feed (not configured).',
    },
    { key: 'policy', label: 'Government Policy', items: topByImportance(weekItems.filter(has(POLICY_RE)), 6) },
    { key: 'geopolitical', label: 'Geopolitical Events', items: topByImportance(weekItems.filter(has(GEOPOLITICAL_RE)), 6) },
  ];
}

export interface SectorRotationRow {
  sector: string;
  bullish: number;
  bearish: number;
  neutral: number;
}

export function sectorRotation(weekItems: NewsItem[]): SectorRotationRow[] {
  const bySector = new Map<string, SectorRotationRow>();
  for (const item of weekItems) {
    if (!item.sector) continue;
    const row = bySector.get(item.sector) ?? { sector: item.sector, bullish: 0, bearish: 0, neutral: 0 };
    if (item.sentiment === 'Bullish') row.bullish += 1;
    else if (item.sentiment === 'Bearish') row.bearish += 1;
    else row.neutral += 1;
    bySector.set(item.sector, row);
  }
  return Array.from(bySector.values()).sort((a, b) => b.bullish - b.bearish - (a.bullish - a.bearish));
}

/** "What happened / why it matters / sectors / beneficiaries / laggards" for one story. */
export function storyBreakdown(item: NewsItem): {
  what: string;
  why: string;
  sectors: string;
  beneficiaries: string;
  laggards: string;
} {
  const sectorList = item.sector ? item.sector : item.categories.join(', ');
  return {
    what: item.headline,
    why:
      item.impact === 'High'
        ? 'High expected market impact — likely to move related names and could shift sector positioning.'
        : item.impact === 'Medium'
          ? 'Moderate expected market impact — worth tracking for follow-through.'
          : 'Low expected market impact — background context rather than a catalyst.',
    sectors: sectorList,
    beneficiaries:
      item.sentiment === 'Bullish' && item.tickers && item.tickers.length > 0
        ? item.tickers.join(', ')
        : item.sentiment === 'Bullish'
          ? `Companies exposed to ${sectorList}`
          : 'None flagged — story is not bullish for named tickers.',
    laggards:
      item.sentiment === 'Bearish' && item.tickers && item.tickers.length > 0
        ? item.tickers.join(', ')
        : item.sentiment === 'Bearish'
          ? `Companies exposed to ${sectorList}`
          : 'None flagged — story is not bearish for named tickers.',
  };
}
