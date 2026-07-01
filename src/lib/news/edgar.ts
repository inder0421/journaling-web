/**
 * SEC EDGAR — free, keyless, and (unlike most RSS feeds) served with CORS enabled
 * on data.sec.gov / efts.sec.gov, so these fetchers hit SEC directly with no proxy.
 */
import type { RawNewsItem } from './types';

const UA_NOTE = { headers: { Accept: 'application/json' } };

/** Small fallback map so company filings work even if the full ticker list can't be fetched. */
const TICKER_CIK_FALLBACK: Record<string, string> = {
  AAPL: '0000320193',
  MSFT: '0000789019',
  GOOGL: '0001652044',
  GOOG: '0001652044',
  AMZN: '0001018724',
  NVDA: '0001045810',
  TSLA: '0001318605',
  META: '0001326801',
  NFLX: '0001065280',
  JPM: '0000019617',
  BAC: '0000070858',
  XOM: '0000034088',
  CVX: '0000093410',
  JNJ: '0000200406',
  PFE: '0000078003',
  V: '0001403161',
  MA: '0001141391',
  WMT: '0000104169',
  DIS: '0001744489',
  KO: '0000021344',
  PEP: '0000077476',
  INTC: '0000050863',
  AMD: '0000002488',
  CRM: '0001108524',
  ORCL: '0001341439',
  BA: '0000012927',
  GS: '0000886982',
  UNH: '0000731766',
  HD: '0000354950',
  COST: '0000909832',
};

let tickerMapCache: Record<string, string> | null = null;

async function loadTickerMap(): Promise<Record<string, string>> {
  if (tickerMapCache) return tickerMapCache;
  try {
    const res = await fetch('https://www.sec.gov/files/company_tickers.json', UA_NOTE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Record<string, { cik_str: number; ticker: string }>;
    const map: Record<string, string> = {};
    for (const entry of Object.values(data)) {
      map[entry.ticker.toUpperCase()] = String(entry.cik_str).padStart(10, '0');
    }
    tickerMapCache = map;
    return map;
  } catch {
    tickerMapCache = TICKER_CIK_FALLBACK;
    return TICKER_CIK_FALLBACK;
  }
}

export async function tickerToCik(ticker: string): Promise<string | null> {
  const upper = ticker.toUpperCase();
  if (TICKER_CIK_FALLBACK[upper]) return TICKER_CIK_FALLBACK[upper];
  const map = await loadTickerMap();
  return map[upper] ?? null;
}

interface SubmissionsResponse {
  filings: {
    recent: {
      form: string[];
      filingDate: string[];
      accessionNumber: string[];
      primaryDocument: string[];
      items?: string[];
    };
  };
}

/** Recent 8-K/10-Q/10-K/Form-4 filings for one ticker, newest first. */
export async function fetchCompanyFilings(ticker: string, limit = 10): Promise<RawNewsItem[]> {
  const cik = await tickerToCik(ticker);
  if (!cik) return [];
  const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, UA_NOTE);
  if (!res.ok) throw new Error(`SEC EDGAR ${ticker} -> HTTP ${res.status}`);
  const data = (await res.json()) as SubmissionsResponse;
  const { form, filingDate, accessionNumber, primaryDocument } = data.filings.recent;

  const items: RawNewsItem[] = [];
  for (let i = 0; i < form.length && items.length < limit; i++) {
    const accession = accessionNumber[i].replace(/-/g, '');
    items.push({
      id: `edgar-${cik}-${accessionNumber[i]}`,
      headline: `${ticker} files Form ${form[i]}`,
      summary: `${ticker} (CIK ${cik}) filed a Form ${form[i]} with the SEC on ${filingDate[i]}.`,
      url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession}/${primaryDocument[i]}`,
      source: 'SEC EDGAR',
      publisher: 'SEC EDGAR',
      time: new Date(`${filingDate[i]}T00:00:00Z`).toISOString(),
      tickers: [ticker],
    });
  }
  return items;
}

interface FullTextSearchHit {
  _source: {
    display_names: string[];
    file_type: string;
    file_date: string;
  };
  _id: string;
}

/** Cross-company recent filings for a set of forms (e.g. 8-K) — feeds the "SEC Filings" bucket. */
export async function fetchRecentFilingsByForm(forms: string[], days = 1): Promise<RawNewsItem[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const params = new URLSearchParams({
    forms: forms.join(','),
    dateRange: 'custom',
    startdt: fmt(start),
    enddt: fmt(end),
  });
  const res = await fetch(`https://efts.sec.gov/LATEST/search-index?${params.toString()}`, UA_NOTE);
  if (!res.ok) throw new Error(`SEC full-text search -> HTTP ${res.status}`);
  const data = (await res.json()) as { hits?: { hits: FullTextSearchHit[] } };
  const hits = data.hits?.hits ?? [];
  return hits.map((hit) => {
    const name = hit._source.display_names[0] ?? 'Unknown filer';
    return {
      id: `edgar-fts-${hit._id}`,
      headline: `${name}: Form ${hit._source.file_type} filed`,
      source: 'SEC EDGAR' as const,
      publisher: 'SEC EDGAR',
      time: new Date(`${hit._source.file_date}T00:00:00Z`).toISOString(),
      tickers: [],
    };
  });
}
