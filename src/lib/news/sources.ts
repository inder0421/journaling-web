/**
 * One fetcher per integration listed in the spec. Each returns a SourceResult so the
 * aggregator/UI can tell "not configured" (missing free API key) apart from "failed"
 * (network/API error) without one bad source breaking the whole dashboard.
 */
import { fetchFeed } from './rss';
import { fetchCompanyFilings, fetchRecentFilingsByForm } from './edgar';
import type { NewsSource, RawNewsItem } from './types';

export interface SourceResult {
  source: NewsSource;
  configured: boolean;
  ok: boolean;
  items: RawNewsItem[];
  error?: string;
}

function ok(source: NewsSource, items: RawNewsItem[]): SourceResult {
  return { source, configured: true, ok: true, items };
}
function notConfigured(source: NewsSource): SourceResult {
  return { source, configured: false, ok: true, items: [] };
}
function failed(source: NewsSource, e: unknown): SourceResult {
  return { source, configured: true, ok: false, items: [], error: e instanceof Error ? e.message : String(e) };
}

/**
 * Several fetchers share a NewsSource name (e.g. Finnhub market news + Finnhub
 * company news both report as 'Finnhub'). Merge them into one row per source so
 * the "Data sources" panel shows one honest status instead of duplicates.
 */
export function mergeBySource(results: SourceResult[]): SourceResult[] {
  const bySource = new Map<NewsSource, SourceResult>();
  for (const r of results) {
    const existing = bySource.get(r.source);
    if (!existing) {
      bySource.set(r.source, { ...r, items: [...r.items] });
      continue;
    }
    existing.items.push(...r.items);
    existing.configured = existing.configured || r.configured;
    existing.ok = existing.ok && r.ok;
    if (!r.ok && !existing.error) existing.error = r.error;
  }
  return Array.from(bySource.values());
}

function env(key: string): string | undefined {
  const v = (import.meta.env as Record<string, string | undefined>)[key];
  return v?.trim() || undefined;
}

async function safely(source: NewsSource, configured: boolean, run: () => Promise<RawNewsItem[]>): Promise<SourceResult> {
  if (!configured) return notConfigured(source);
  try {
    return ok(source, await run());
  } catch (e) {
    return failed(source, e);
  }
}

/* ---------------------------- Finnhub ---------------------------- */

export async function fetchFinnhubMarketNews(): Promise<SourceResult> {
  const key = env('VITE_FINNHUB_API_KEY');
  return safely('Finnhub', Boolean(key), async () => {
    const res = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${key}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Array<{
      id: number; headline: string; summary: string; url: string; source: string; datetime: number; related?: string;
    }>;
    return data.map((n) => ({
      id: `finnhub-${n.id}`,
      headline: n.headline,
      summary: n.summary,
      url: n.url,
      source: 'Finnhub' as const,
      publisher: n.source,
      time: new Date(n.datetime * 1000).toISOString(),
      tickers: n.related ? n.related.split(',').filter(Boolean) : [],
    }));
  });
}

export async function fetchFinnhubCompanyNews(tickers: string[]): Promise<SourceResult> {
  const key = env('VITE_FINNHUB_API_KEY');
  return safely('Finnhub', Boolean(key) && tickers.length > 0, async () => {
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 86_400_000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const results = await Promise.all(
      tickers.map(async (t) => {
        const res = await fetch(
          `https://finnhub.io/api/v1/company-news?symbol=${t}&from=${fmt(from)}&to=${fmt(to)}&token=${key}`,
        );
        if (!res.ok) return [];
        const data = (await res.json()) as Array<{
          id: number; headline: string; summary: string; url: string; source: string; datetime: number;
        }>;
        return data.map((n) => ({
          id: `finnhub-co-${n.id}`,
          headline: n.headline,
          summary: n.summary,
          url: n.url,
          source: 'Finnhub' as const,
          publisher: n.source,
          time: new Date(n.datetime * 1000).toISOString(),
          tickers: [t],
        }));
      }),
    );
    return results.flat();
  });
}

/* ------------------------------ FMP -------------------------------- */

export async function fetchFmpStockNews(tickers: string[]): Promise<SourceResult> {
  const key = env('VITE_FMP_API_KEY');
  return safely('Financial Modeling Prep', Boolean(key), async () => {
    const tickerParam = tickers.length > 0 ? `tickers=${tickers.join(',')}&` : '';
    const res = await fetch(
      `https://financialmodelingprep.com/api/v3/stock_news?${tickerParam}limit=50&apikey=${key}`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Array<{
      symbol: string; publishedDate: string; title: string; site: string; text: string; url: string;
    }>;
    return data.map((n, i) => ({
      id: `fmp-${i}-${n.publishedDate}`,
      headline: n.title,
      summary: n.text,
      url: n.url,
      source: 'Financial Modeling Prep' as const,
      publisher: n.site,
      time: new Date(n.publishedDate).toISOString(),
      tickers: n.symbol ? [n.symbol] : [],
    }));
  });
}

export async function fetchFmpEconomicCalendar(from: string, to: string): Promise<{
  configured: boolean;
  ok: boolean;
  error?: string;
  items: { event: string; date: string; country: string; actual?: number; estimate?: number; previous?: number; impact?: string }[];
}> {
  const key = env('VITE_FMP_API_KEY');
  if (!key) return { configured: false, ok: true, items: [] };
  try {
    const res = await fetch(
      `https://financialmodelingprep.com/api/v3/economic_calendar?from=${from}&to=${to}&apikey=${key}`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = (await res.json()) as {
      event: string; date: string; country: string; actual?: number; estimate?: number; previous?: number; impact?: string;
    }[];
    return { configured: true, ok: true, items };
  } catch (e) {
    return { configured: true, ok: false, error: e instanceof Error ? e.message : String(e), items: [] };
  }
}

/* -------------------------- Alpha Vantage --------------------------- */

export async function fetchAlphaVantageNews(tickers: string[]): Promise<SourceResult> {
  const key = env('VITE_ALPHA_VANTAGE_API_KEY');
  return safely('Alpha Vantage', Boolean(key), async () => {
    const tickerParam = tickers.length > 0 ? `&tickers=${tickers.join(',')}` : '';
    const res = await fetch(
      `https://www.alphavantage.co/query?function=NEWS_SENTIMENT${tickerParam}&apikey=${key}`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      feed?: Array<{
        title: string; url: string; time_published: string; summary: string; source: string;
        overall_sentiment_score: number; overall_sentiment_label: string;
        ticker_sentiment?: Array<{ ticker: string }>;
      }>;
    };
    return (data.feed ?? []).map((n, i) => ({
      id: `av-${i}-${n.time_published}`,
      headline: n.title,
      summary: n.summary,
      url: n.url,
      source: 'Alpha Vantage' as const,
      publisher: n.source,
      time: parseAlphaVantageTime(n.time_published),
      tickers: n.ticker_sentiment?.map((t) => t.ticker) ?? [],
      providedSentiment: {
        label: mapAvSentiment(n.overall_sentiment_label),
        score: Math.round(50 + n.overall_sentiment_score * 50),
      },
    }));
  });
}

function parseAlphaVantageTime(t: string): string {
  // Format: YYYYMMDDTHHMMSS
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(t);
  if (!m) return new Date().toISOString();
  const [, y, mo, d, h, mi, s] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)).toISOString();
}

function mapAvSentiment(label: string): 'Bullish' | 'Bearish' | 'Neutral' {
  if (label.toLowerCase().includes('bullish')) return 'Bullish';
  if (label.toLowerCase().includes('bearish')) return 'Bearish';
  return 'Neutral';
}

/* --------------------------- Yahoo Finance --------------------------- */

export async function fetchYahooFinanceNews(tickers: string[]): Promise<SourceResult> {
  return safely('Yahoo Finance', tickers.length > 0, async () => {
    const results = await Promise.all(
      tickers.map(async (t) => {
        try {
          const items = await fetchFeed(
            `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${t}&region=US&lang=en-US`,
          );
          return items.map((it, i) => ({
            id: `yahoo-${t}-${i}-${it.pubDate ?? ''}`,
            headline: it.title,
            summary: it.description,
            url: it.link,
            source: 'Yahoo Finance' as const,
            publisher: 'Yahoo Finance',
            time: it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString(),
            tickers: [t],
          }));
        } catch {
          return [];
        }
      }),
    );
    return results.flat();
  });
}

/* -------------- Federal Reserve / BLS / BEA / SEC (RSS, keyless) ------------- */

async function feedSource(source: NewsSource, url: string, tag: string): Promise<SourceResult> {
  return safely(source, true, async () => {
    const items = await fetchFeed(url);
    return items.map((it, i) => ({
      id: `${tag}-${i}-${it.pubDate ?? it.title}`,
      headline: it.title,
      summary: it.description,
      url: it.link,
      source,
      publisher: source,
      time: it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString(),
      tickers: [],
    }));
  });
}

export function fetchFedReserveNews(): Promise<SourceResult> {
  return feedSource('Federal Reserve', 'https://www.federalreserve.gov/feeds/press_all.xml', 'fed');
}

export function fetchBlsNews(): Promise<SourceResult> {
  return feedSource('U.S. Bureau of Labor Statistics', 'https://www.bls.gov/feed/bls_latest.rss', 'bls');
}

export function fetchBeaNews(): Promise<SourceResult> {
  return feedSource('U.S. Bureau of Economic Analysis', 'https://apps.bea.gov/rss/rss.xml', 'bea');
}

/** SEC press releases (distinct from EDGAR filings) — also keyless RSS. */
export function fetchSecPressReleases(): Promise<SourceResult> {
  return feedSource('SEC EDGAR', 'https://www.sec.gov/news/pressreleases.rss', 'sec-pr');
}

/* ------------------------------ SEC EDGAR ----------------------------- */

export async function fetchEdgarCompanyFilings(tickers: string[]): Promise<SourceResult> {
  return safely('SEC EDGAR', tickers.length > 0, async () => {
    const results = await Promise.all(
      tickers.map((t) =>
        fetchCompanyFilings(t).catch(() => [] as RawNewsItem[]),
      ),
    );
    return results.flat();
  });
}

export function fetchEdgarRecent8Ks(): Promise<SourceResult> {
  return safely('SEC EDGAR', true, () => fetchRecentFilingsByForm(['8-K'], 1));
}
