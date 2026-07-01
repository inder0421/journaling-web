/** Browser-local watchlist of tickers tracked by the Company News section. */

const KEY = 'tdj:news-watchlist';
const DEFAULT_WATCHLIST = ['AAPL', 'MSFT', 'NVDA', 'TSLA'];

export function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_WATCHLIST;
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_WATCHLIST;
  } catch {
    return DEFAULT_WATCHLIST;
  }
}

export function saveWatchlist(tickers: string[]): void {
  localStorage.setItem(KEY, JSON.stringify(tickers));
}

export function addToWatchlist(ticker: string): string[] {
  const clean = ticker.trim().toUpperCase();
  if (!clean) return loadWatchlist();
  const next = Array.from(new Set([...loadWatchlist(), clean]));
  saveWatchlist(next);
  return next;
}

export function removeFromWatchlist(ticker: string): string[] {
  const next = loadWatchlist().filter((t) => t !== ticker);
  saveWatchlist(next);
  return next;
}
