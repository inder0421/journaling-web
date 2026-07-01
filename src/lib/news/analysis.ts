/**
 * Lightweight, dependency-free NLP: keyword-weighted sentiment/importance scoring.
 * Runs entirely client-side so the dashboard works with zero API keys configured.
 * A source can still override sentiment (see RawNewsItem.providedSentiment) when it
 * ships its own model output (e.g. Alpha Vantage NEWS_SENTIMENT).
 */
import type { Impact, NewsCategory, Sentiment } from './types';

const POSITIVE_WORDS: Record<string, number> = {
  surge: 2, surges: 2, surged: 2, soar: 2, soars: 2, soared: 2, rally: 2, rallies: 2, rallied: 2,
  beat: 2, beats: 2, 'beat estimates': 3, 'tops estimates': 3, record: 2, 'all-time high': 3,
  upgrade: 2, upgraded: 2, outperform: 2, 'raises guidance': 3, 'raised guidance': 3,
  approval: 2, approved: 2, breakthrough: 3, profit: 1, profits: 1, growth: 1, expands: 1,
  expansion: 1, buyback: 2, dividend: 1, 'raises dividend': 3, bullish: 2, optimistic: 1,
  strong: 1, strength: 1, gains: 1, gain: 1, jumps: 2, jumped: 2, climbs: 1, climbed: 1,
  boom: 2, robust: 1, exceeds: 2, outperforms: 2, win: 1, wins: 1, partnership: 1, acquires: 1,
  acquisition: 1, resilient: 1, recovery: 1, rebound: 1, 'better-than-expected': 2, easing: 1,
  cut: -1, // placeholder overwritten below intentionally not used
};
// Remove accidental placeholder above; 'cut' is ambiguous (rate cut is bullish, job cuts bearish)
delete POSITIVE_WORDS.cut;

const NEGATIVE_WORDS: Record<string, number> = {
  plunge: 2, plunges: 2, plunged: 2, slump: 2, slumps: 2, slumped: 2, tumble: 2, tumbles: 2,
  tumbled: 2, miss: 2, misses: 2, 'misses estimates': 3, 'falls short': 2, downgrade: 2,
  downgraded: 2, underperform: 2, 'cuts guidance': 3, 'lowers guidance': 3, 'cuts forecast': 3,
  recall: 2, lawsuit: 2, investigation: 2, probe: 2, fraud: 3, bankruptcy: 3, layoffs: 2,
  'job cuts': 2, 'mass layoffs': 3, decline: 1, declines: 1, declined: 1, falls: 1, fell: 1,
  drop: 1, drops: 1, dropped: 1, weak: 1, weakness: 1, losses: 1, loss: 1, bearish: 2,
  pessimistic: 1, plummets: 2, plummeted: 2, warns: 1, warning: 1, sued: 2, halted: 2,
  halt: 2, breach: 2, hack: 2, recession: 2, slowdown: 1, contraction: 2, default: 2,
  delisted: 2, shortfall: 2, disappointing: 2,
};

const HIGH_IMPACT_KEYWORDS = [
  'federal reserve', 'fomc', 'rate hike', 'rate cut', 'interest rate', 'powell',
  'cpi', 'inflation', 'ppi', 'pce', 'nonfarm payrolls', 'jobs report', 'unemployment rate',
  'merger', 'acquisition', 'acquire', 'takeover', 'buyout',
  'fda approval', 'fda approves', 'clinical trial', 'recall',
  'bankruptcy', 'earnings', 'guidance', 'stock split', 'buyback',
  'sec filing', '8-k', '10-q', '10-k', 'insider', 'data breach',
];

const CATEGORY_BASE_IMPORTANCE: Partial<Record<NewsCategory, number>> = {
  'Federal Reserve': 9,
  'Interest Rates': 8,
  Inflation: 8,
  Employment: 8,
  'Economic News': 6,
  'Mergers & Acquisitions': 7,
  'FDA Announcements': 7,
  Earnings: 6,
  'Analyst Upgrades': 5,
  'Analyst Downgrades': 5,
  'SEC Filings': 4,
  'Insider Buying/Selling': 4,
  'Market News': 4,
  Technology: 4,
  Energy: 4,
  Healthcare: 4,
  Financials: 4,
  Consumer: 3,
  AI: 4,
  Crypto: 4,
};

function countMatches(text: string, lexicon: Record<string, number>): number {
  let total = 0;
  for (const [phrase, weight] of Object.entries(lexicon)) {
    const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = text.match(re);
    if (matches) total += matches.length * weight;
  }
  return total;
}

/** Net sentiment classification + a 0-100 confidence score, from headline+summary text. */
export function scoreSentiment(text: string): { label: Sentiment; confidence: number } {
  const lower = text.toLowerCase();
  const pos = countMatches(lower, POSITIVE_WORDS);
  const neg = countMatches(lower, NEGATIVE_WORDS);
  const net = pos - neg;
  const magnitude = Math.min(1, Math.abs(net) / 6);
  const confidence = Math.round(50 + magnitude * 45);

  if (Math.abs(net) < 1) return { label: 'Neutral', confidence: Math.round(50 + magnitude * 10) };
  return { label: net > 0 ? 'Bullish' : 'Bearish', confidence };
}

/** 1-10 importance score from category weight, keyword hits, and sentiment magnitude. */
export function scoreImportance(
  text: string,
  categories: NewsCategory[],
  sentimentConfidence: number,
): number {
  const lower = text.toLowerCase();
  const base = Math.max(3, ...categories.map((c) => CATEGORY_BASE_IMPORTANCE[c] ?? 3));
  const keywordHits = HIGH_IMPACT_KEYWORDS.reduce((n, kw) => (lower.includes(kw) ? n + 1 : n), 0);
  const confidenceBoost = (sentimentConfidence - 50) / 50; // -1..1
  const raw = base + keywordHits * 0.6 + confidenceBoost;
  return Math.max(1, Math.min(10, Math.round(raw)));
}

/** Expected market impact from importance + how strongly the market is likely to react. */
export function scoreImpact(importance: number, sentimentConfidence: number): Impact {
  const weight = importance + (sentimentConfidence - 50) / 20;
  if (weight >= 8) return 'High';
  if (weight >= 5) return 'Medium';
  return 'Low';
}

/** Extractive one-to-two sentence summary — no external LLM call required. */
export function summarize(headline: string, body?: string): string {
  const source = (body ?? '').trim();
  if (!source) return headline.trim();
  const sentences = source
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 20);
  if (sentences.length === 0) return headline.trim();
  const picked = sentences.slice(0, 2).join(' ');
  return picked.length > 320 ? `${picked.slice(0, 317)}...` : picked;
}
