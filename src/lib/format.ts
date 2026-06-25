/** Formatting helpers shared across the UI. */

const usd0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const usd2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Currency, no cents. e.g. -$500 */
export function money(n: number): string {
  return usd0.format(n);
}

/** Currency with explicit sign, no cents. e.g. +$320 / -$500 */
export function moneySigned(n: number): string {
  const s = usd0.format(Math.abs(n));
  if (n > 0) return `+${s}`;
  if (n < 0) return `-${s}`;
  return s;
}

/** Currency with cents. e.g. $48,000.00 */
export function moneyExact(n: number): string {
  return usd2.format(n);
}

/** Percent from a 0..1 ratio, or em-dash when null. e.g. 0.5 -> "50%" */
export function percent(ratio: number | null, digits = 0): string {
  if (ratio === null || Number.isNaN(ratio)) return '—';
  return `${(ratio * 100).toFixed(digits)}%`;
}

const dayFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const timeFmt = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

/** "Mon, Jun 23, 2025" from a YYYY-MM-DD local day key. */
export function formatDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  return dayFmt.format(new Date(y, m - 1, d));
}

/** "3:42 PM" from an ISO timestamp. */
export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

/** Value for a <input type="datetime-local"> from a Date, in local time. */
export function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}
