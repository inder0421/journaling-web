import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { aggregate, withinDays, withinHours } from './aggregator';
import { deriveAlerts, notifyBrowser } from './alerts';
import { loadEconomicCalendar, type CalendarResult } from './calendar';
import { computeDailyScore } from './score';
import {
  fetchAlphaVantageNews,
  fetchBeaNews,
  fetchBlsNews,
  fetchEdgarCompanyFilings,
  fetchEdgarRecent8Ks,
  fetchFedReserveNews,
  fetchFinnhubCompanyNews,
  fetchFinnhubMarketNews,
  fetchFmpStockNews,
  fetchSecPressReleases,
  fetchYahooFinanceNews,
  mergeBySource,
  type SourceResult,
} from './sources';
import { loadWatchlist, saveWatchlist } from './watchlist';
import type { Alert, DailyScore, NewsItem } from './types';

const POLL_MS = 5 * 60_000;

export interface NewsData {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
  allItems: NewsItem[];
  todaysItems: NewsItem[];
  weekItems: NewsItem[];
  sourceStatuses: SourceResult[];
  watchlist: string[];
  setWatchlist: (tickers: string[]) => void;
  companyItems: (ticker: string) => NewsItem[];
  calendarToday: CalendarResult;
  calendarTomorrow: CalendarResult;
  calendarWeek: CalendarResult;
  dailyScore: DailyScore;
  alerts: Alert[];
  refresh: () => Promise<void>;
}

const EMPTY_CALENDAR: CalendarResult = { events: [], live: false };

export function useNews(): NewsData {
  const [watchlist, setWatchlistState] = useState<string[]>(() => loadWatchlist());
  const [allItems, setAllItems] = useState<NewsItem[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<SourceResult[]>([]);
  const [calendarToday, setCalendarToday] = useState<CalendarResult>(EMPTY_CALENDAR);
  const [calendarTomorrow, setCalendarTomorrow] = useState<CalendarResult>(EMPTY_CALENDAR);
  const [calendarWeek, setCalendarWeek] = useState<CalendarResult>(EMPTY_CALENDAR);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const seenAlertIds = useRef<Set<string>>(new Set());
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const watchlistRef = useRef(watchlist);
  watchlistRef.current = watchlist;

  const setWatchlist = useCallback((tickers: string[]) => {
    saveWatchlist(tickers);
    setWatchlistState(tickers);
  }, []);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const tickers = watchlistRef.current;
      const results = await Promise.all([
        fetchFinnhubMarketNews(),
        fetchFinnhubCompanyNews(tickers),
        fetchFmpStockNews([]),
        fetchFmpStockNews(tickers),
        fetchAlphaVantageNews(tickers),
        fetchYahooFinanceNews(tickers),
        fetchEdgarCompanyFilings(tickers),
        fetchEdgarRecent8Ks(),
        fetchFedReserveNews(),
        fetchBlsNews(),
        fetchBeaNews(),
        fetchSecPressReleases(),
      ]);
      setSourceStatuses(mergeBySource(results));

      const merged = aggregate(results);
      setAllItems(merged);

      const today = withinHours(merged, 24);
      const nextAlerts = deriveAlerts(today, tickers).filter((a) => !seenAlertIds.current.has(a.id));
      for (const a of nextAlerts) {
        seenAlertIds.current.add(a.id);
        if (isRefresh) notifyBrowser(a);
      }
      setAlerts((prev) => [...nextAlerts, ...prev].slice(0, 100));

      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setUTCHours(0, 0, 0, 0);
      const endOfToday = new Date(startOfToday.getTime() + 86_400_000 - 1);
      const startOfTomorrow = new Date(startOfToday.getTime() + 86_400_000);
      const endOfTomorrow = new Date(startOfTomorrow.getTime() + 86_400_000 - 1);
      const endOfWeek = new Date(startOfToday.getTime() + 7 * 86_400_000 - 1);

      const [cToday, cTomorrow, cWeek] = await Promise.all([
        loadEconomicCalendar(startOfToday, endOfToday),
        loadEconomicCalendar(startOfTomorrow, endOfTomorrow),
        loadEconomicCalendar(startOfToday, endOfWeek),
      ]);
      setCalendarToday(cToday);
      setCalendarTomorrow(cTomorrow);
      setCalendarWeek(cWeek);

      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    void load(false);
    const timer = setInterval(() => void load(true), POLL_MS);
    return () => clearInterval(timer);
    // Reload from scratch when the watchlist changes; polling interval is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist.join(',')]);

  const todaysItems = useMemo(() => withinHours(allItems, 24), [allItems]);
  const weekItems = useMemo(() => withinDays(allItems, 7), [allItems]);
  const dailyScore = useMemo(() => computeDailyScore(todaysItems), [todaysItems]);
  const companyItems = useCallback(
    (ticker: string) => allItems.filter((i) => (i.tickers ?? []).some((t) => t.toUpperCase() === ticker.toUpperCase())),
    [allItems],
  );

  return {
    loading,
    refreshing,
    error,
    lastUpdated,
    allItems,
    todaysItems,
    weekItems,
    sourceStatuses,
    watchlist,
    setWatchlist,
    companyItems,
    calendarToday,
    calendarTomorrow,
    calendarWeek,
    dailyScore,
    alerts,
    refresh,
  };
}
