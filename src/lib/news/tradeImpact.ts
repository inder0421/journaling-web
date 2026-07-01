/** Derives an "AI Trade Impact" read-out for a story: sentiment, confidence, sectors, volatility, ideas. */
import type { NewsItem, TradeImpact } from './types';
import { topByImportance } from './aggregator';

const SECTOR_BY_CATEGORY: Record<string, string[]> = {
  Technology: ['Technology'],
  AI: ['Technology', 'Communication Services'],
  Energy: ['Energy'],
  Healthcare: ['Healthcare'],
  Financials: ['Financials'],
  Consumer: ['Consumer Discretionary', 'Consumer Staples'],
  Crypto: ['Digital Assets'],
  'Federal Reserve': ['Rate-sensitive equities', 'Financials', 'Real Estate'],
  'Interest Rates': ['Rate-sensitive equities', 'Financials', 'Real Estate'],
  Inflation: ['Consumer Discretionary', 'Retail'],
  Employment: ['Broad market'],
  'Mergers & Acquisitions': ['Deal-target sector'],
  'FDA Announcements': ['Healthcare', 'Biotech'],
};

function affectedSectors(item: NewsItem): string[] {
  const sectors = new Set<string>();
  for (const cat of item.categories) {
    for (const s of SECTOR_BY_CATEGORY[cat] ?? []) sectors.add(s);
  }
  if (item.sector) sectors.add(item.sector);
  return sectors.size > 0 ? Array.from(sectors) : ['Broad market'];
}

function opportunities(item: NewsItem): string[] {
  const dir = item.sentiment === 'Bullish' ? 'upside' : item.sentiment === 'Bearish' ? 'downside' : 'range-bound';
  const ideas: string[] = [];
  if (item.tickers && item.tickers.length > 0) {
    ideas.push(`Directional ${dir} setups in ${item.tickers.slice(0, 3).join(', ')} on confirmation.`);
  }
  if (item.impact === 'High') {
    ideas.push('Elevated volatility likely — consider wider stops or reduced size around the headline.');
  }
  if (item.categories.includes('Mergers & Acquisitions')) {
    ideas.push('Watch for merger-arb spread moves in the target/acquirer pair.');
  }
  if (item.categories.some((c) => ['Federal Reserve', 'Interest Rates'].includes(c))) {
    ideas.push('Rate-sensitive sectors (financials, real estate, growth tech) may see outsized reaction.');
  }
  if (ideas.length === 0) ideas.push('No clear single-name setup — monitor for follow-through before acting.');
  return ideas;
}

export function toTradeImpact(item: NewsItem): TradeImpact {
  return {
    item,
    sentiment: item.sentiment,
    confidence: item.sentimentConfidence,
    affectedSectors: affectedSectors(item),
    volatility: item.impact,
    opportunities: opportunities(item),
  };
}

export function topTradeImpacts(items: NewsItem[], n = 8): TradeImpact[] {
  return topByImportance(items, n).map(toTradeImpact);
}
