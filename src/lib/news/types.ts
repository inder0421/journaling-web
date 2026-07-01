/** Shared types for the News Intelligence Engine. */

export type Sentiment = 'Bullish' | 'Bearish' | 'Neutral';
export type Impact = 'Low' | 'Medium' | 'High';

/** The grouping buckets requested by the dashboard spec. A story may match several. */
export type NewsCategory =
  | 'Market News'
  | 'Economic News'
  | 'Federal Reserve'
  | 'Inflation'
  | 'Employment'
  | 'Interest Rates'
  | 'Earnings'
  | 'Analyst Upgrades'
  | 'Analyst Downgrades'
  | 'Mergers & Acquisitions'
  | 'FDA Announcements'
  | 'SEC Filings'
  | 'Insider Buying/Selling'
  | 'Technology'
  | 'Energy'
  | 'Healthcare'
  | 'Financials'
  | 'Consumer'
  | 'AI'
  | 'Crypto';

export const NEWS_CATEGORIES: NewsCategory[] = [
  'Market News',
  'Economic News',
  'Federal Reserve',
  'Inflation',
  'Employment',
  'Interest Rates',
  'Earnings',
  'Analyst Upgrades',
  'Analyst Downgrades',
  'Mergers & Acquisitions',
  'FDA Announcements',
  'SEC Filings',
  'Insider Buying/Selling',
  'Technology',
  'Energy',
  'Healthcare',
  'Financials',
  'Consumer',
  'AI',
  'Crypto',
];

/** Which integration produced a story — surfaced in the UI so users know what's live. */
export type NewsSource =
  | 'Finnhub'
  | 'Yahoo Finance'
  | 'SEC EDGAR'
  | 'Financial Modeling Prep'
  | 'Alpha Vantage'
  | 'Federal Reserve'
  | 'U.S. Bureau of Labor Statistics'
  | 'U.S. Bureau of Economic Analysis'
  | 'RSS';

/** Raw item shape returned by a source fetcher, before category/AI enrichment. */
export interface RawNewsItem {
  id: string;
  headline: string;
  summary?: string;
  url?: string;
  source: NewsSource;
  publisher?: string;
  /** ISO timestamp. */
  time: string;
  tickers?: string[];
  /** Pre-existing sentiment from the source itself (e.g. Alpha Vantage), if any. */
  providedSentiment?: { label: Sentiment; score: number };
}

/** A story after category/sentiment/importance/impact enrichment — what the UI renders. */
export interface NewsItem extends RawNewsItem {
  categories: NewsCategory[];
  sector: string | null;
  aiSummary: string;
  sentiment: Sentiment;
  sentimentConfidence: number;
  importance: number;
  impact: Impact;
}

export interface EconomicEvent {
  id: string;
  time: string;
  country: string;
  event: string;
  forecast?: string;
  previous?: string;
  actual?: string;
  importance: 1 | 2 | 3;
  impact: Impact;
  estimated: boolean;
}

export interface DailyScore {
  score: number;
  label: 'Very Bullish' | 'Bullish' | 'Neutral' | 'Bearish' | 'Very Bearish';
  factors: { label: string; value: string; contribution: number }[];
}

export interface TradeImpact {
  item: NewsItem;
  sentiment: Sentiment;
  confidence: number;
  affectedSectors: string[];
  volatility: Impact;
  opportunities: string[];
}

export interface Alert {
  id: string;
  time: string;
  kind: 'breaking' | 'watchlist' | 'economic' | 'fed' | 'earnings' | 'gap';
  message: string;
  item?: NewsItem;
}
