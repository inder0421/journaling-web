/**
 * Economic calendar. When VITE_FMP_API_KEY is set we use FMP's live calendar (real
 * forecast/previous/actual values, including FOMC/Fed events). Without a key we still
 * want a useful calendar, so we generate the well-known *recurring* U.S. releases
 * (CPI, PPI, PCE, NFP, Retail Sales, Consumer Confidence, PMI) from their standard
 * publication rules and mark them "estimated" — we deliberately do NOT fabricate
 * one-off dates (FOMC meeting dates, Fed speaker calendars, Treasury auction
 * schedules) since those aren't derivable from a fixed rule and guessing them would
 * be misleading; those three surface only from the live FMP/Finnhub feed.
 */
import { fetchFmpEconomicCalendar } from './sources';
import type { EconomicEvent, Impact } from './types';

function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const d = new Date(Date.UTC(year, month, 1));
  let count = 0;
  while (true) {
    if (d.getUTCDay() === weekday) {
      count += 1;
      if (count === n) return d;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

function lastWeekday(year: number, month: number, weekday: number): Date {
  const d = new Date(Date.UTC(year, month + 1, 0));
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

function nthBusinessDay(year: number, month: number, n: number): Date {
  const d = new Date(Date.UTC(year, month, 1));
  let count = 0;
  while (true) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) {
      count += 1;
      if (count === n) return d;
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

interface RecurringDef {
  event: string;
  importance: 1 | 2 | 3;
  impact: Impact;
  at: (year: number, month: number) => Date;
}

const RECURRING: RecurringDef[] = [
  { event: 'Nonfarm Payrolls / Unemployment Rate', importance: 3, impact: 'High', at: (y, m) => nthWeekday(y, m, 5, 1) },
  { event: 'CPI (Consumer Price Index)', importance: 3, impact: 'High', at: (y, m) => nthBusinessDay(y, m, 10) },
  { event: 'PPI (Producer Price Index)', importance: 2, impact: 'Medium', at: (y, m) => nthBusinessDay(y, m, 11) },
  { event: 'PCE Price Index', importance: 3, impact: 'High', at: (y, m) => lastWeekday(y, m, 5) },
  { event: 'Retail Sales', importance: 2, impact: 'Medium', at: (y, m) => nthBusinessDay(y, m, 14) },
  { event: 'ISM Manufacturing PMI', importance: 2, impact: 'Medium', at: (y, m) => nthBusinessDay(y, m, 1) },
  { event: 'ISM Services PMI', importance: 2, impact: 'Medium', at: (y, m) => nthBusinessDay(y, m, 3) },
  { event: 'Consumer Confidence (Conference Board)', importance: 2, impact: 'Medium', at: (y, m) => lastWeekday(y, m, 2) },
];

function estimatedEvents(rangeStart: Date, rangeEnd: Date): EconomicEvent[] {
  const events: EconomicEvent[] = [];
  const months = new Set<string>();
  for (const d = new Date(rangeStart); d <= rangeEnd; d.setUTCDate(d.getUTCDate() + 1)) {
    months.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}`);
  }
  for (const key of months) {
    const [y, m] = key.split('-').map(Number);
    for (const def of RECURRING) {
      const date = def.at(y, m);
      if (date >= rangeStart && date <= rangeEnd) {
        events.push({
          id: `est-${def.event}-${date.toISOString().slice(0, 10)}`,
          time: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 30)).toISOString(),
          country: 'US',
          event: def.event,
          importance: def.importance,
          impact: def.impact,
          estimated: true,
        });
      }
    }
  }
  return events.sort((a, b) => +new Date(a.time) - +new Date(b.time));
}

function fmpImpact(raw?: string): Impact {
  const v = (raw ?? '').toLowerCase();
  if (v === 'high') return 'High';
  if (v === 'low') return 'Low';
  return 'Medium';
}

function fmpImportance(impact: Impact): 1 | 2 | 3 {
  return impact === 'High' ? 3 : impact === 'Medium' ? 2 : 1;
}

export interface CalendarResult {
  events: EconomicEvent[];
  live: boolean;
  error?: string;
}

/** Fetches the calendar for [rangeStart, rangeEnd] (inclusive), live where possible. */
export async function loadEconomicCalendar(rangeStart: Date, rangeEnd: Date): Promise<CalendarResult> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const live = await fetchFmpEconomicCalendar(fmt(rangeStart), fmt(rangeEnd));

  if (!live.configured) {
    return { events: estimatedEvents(rangeStart, rangeEnd), live: false };
  }
  if (!live.ok) {
    return { events: estimatedEvents(rangeStart, rangeEnd), live: false, error: live.error };
  }
  const events: EconomicEvent[] = live.items
    .filter((i) => i.country === 'US')
    .map((i, idx) => {
      const impact = fmpImpact(i.impact);
      return {
        id: `fmp-${idx}-${i.date}`,
        time: new Date(i.date).toISOString(),
        country: i.country,
        event: i.event,
        forecast: i.estimate !== undefined ? String(i.estimate) : undefined,
        previous: i.previous !== undefined ? String(i.previous) : undefined,
        actual: i.actual !== undefined ? String(i.actual) : undefined,
        importance: fmpImportance(impact),
        impact,
        estimated: false,
      };
    });
  return { events: events.sort((a, b) => +new Date(a.time) - +new Date(b.time)), live: true };
}
