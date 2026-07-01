/** Merges raw items from every source into enriched, deduped, sorted NewsItem[]. */
import { categorize } from './categorize';
import { scoreImpact, scoreImportance, scoreSentiment, summarize } from './analysis';
import type { NewsCategory, NewsItem, RawNewsItem } from './types';
import type { SourceResult } from './sources';

function normalizeTitle(headline: string): string {
  return headline
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function enrich(raw: RawNewsItem): NewsItem {
  const text = `${raw.headline} ${raw.summary ?? ''}`;
  const { categories, sector } = categorize(text);
  const sentiment = raw.providedSentiment
    ? { label: raw.providedSentiment.label, confidence: raw.providedSentiment.score }
    : scoreSentiment(text);
  const importance = scoreImportance(text, categories, sentiment.confidence);
  return {
    ...raw,
    categories,
    sector,
    aiSummary: summarize(raw.headline, raw.summary),
    sentiment: sentiment.label,
    sentimentConfidence: sentiment.confidence,
    importance,
    impact: scoreImpact(importance, sentiment.confidence),
  };
}

/** Combines source results into a single enriched, deduped, newest-first feed. */
export function aggregate(results: SourceResult[]): NewsItem[] {
  const seen = new Map<string, NewsItem>();
  for (const result of results) {
    for (const raw of result.items) {
      const key = raw.url || normalizeTitle(raw.headline);
      const existing = seen.get(key);
      if (existing) {
        // Merge tickers from the duplicate hit (same story from two sources).
        existing.tickers = Array.from(new Set([...(existing.tickers ?? []), ...(raw.tickers ?? [])]));
        continue;
      }
      seen.set(key, enrich(raw));
    }
  }
  return Array.from(seen.values()).sort((a, b) => +new Date(b.time) - +new Date(a.time));
}

export function withinHours(items: NewsItem[], hours: number): NewsItem[] {
  const cutoff = Date.now() - hours * 3_600_000;
  return items.filter((i) => +new Date(i.time) >= cutoff);
}

export function withinDays(items: NewsItem[], days: number): NewsItem[] {
  return withinHours(items, days * 24);
}

/** Groups items by every category they matched (a story can land in >1 bucket). */
export function groupByCategory(items: NewsItem[]): Map<NewsCategory, NewsItem[]> {
  const map = new Map<NewsCategory, NewsItem[]>();
  for (const item of items) {
    for (const cat of item.categories) {
      const bucket = map.get(cat) ?? [];
      bucket.push(item);
      map.set(cat, bucket);
    }
  }
  return map;
}

export function topByImportance(items: NewsItem[], n: number): NewsItem[] {
  return [...items].sort((a, b) => b.importance - a.importance).slice(0, n);
}
