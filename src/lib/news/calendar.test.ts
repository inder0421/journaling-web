import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./sources', () => ({
  fetchFmpEconomicCalendar: vi.fn(async () => ({ configured: false, ok: true, items: [] })),
}));

import { loadEconomicCalendar } from './calendar';

describe('loadEconomicCalendar (no API key configured)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to an estimated recurring schedule for the whole month', async () => {
    const start = new Date(Date.UTC(2026, 6, 1));
    const end = new Date(Date.UTC(2026, 6, 31, 23, 59, 59));
    const result = await loadEconomicCalendar(start, end);

    expect(result.live).toBe(false);
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events.every((e) => e.estimated)).toBe(true);
    expect(result.events).toEqual([...result.events].sort((a, b) => +new Date(a.time) - +new Date(b.time)));
  });

  it('includes a Nonfarm Payrolls estimate on the first Friday of the month', async () => {
    const start = new Date(Date.UTC(2026, 6, 1));
    const end = new Date(Date.UTC(2026, 6, 31, 23, 59, 59));
    const result = await loadEconomicCalendar(start, end);
    const nfp = result.events.find((e) => e.event.includes('Nonfarm Payrolls'));
    expect(nfp).toBeDefined();
    const day = new Date(nfp!.time).getUTCDay();
    expect(day).toBe(5); // Friday
  });

  it('returns no events for a narrow window with no matching recurring release', async () => {
    // Pick a single day unlikely to hit any recurring rule for July 2026.
    const start = new Date(Date.UTC(2026, 6, 22));
    const end = new Date(Date.UTC(2026, 6, 22, 23, 59, 59));
    const result = await loadEconomicCalendar(start, end);
    expect(result.events.length).toBe(0);
  });
});
