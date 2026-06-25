/** Plain dollars, no sign forcing: $1,234 or -$1,234. */
export function money(n: number): string {
  const v = Math.round(n);
  const abs = Math.abs(v).toLocaleString("en-US");
  return v < 0 ? `-$${abs}` : `$${abs}`;
}

/** Dollars with an explicit + on gains, for P&L displays: +$1,234 / -$500. */
export function signedMoney(n: number): string {
  const v = Math.round(n);
  if (v === 0) return "$0";
  const abs = Math.abs(v).toLocaleString("en-US");
  return v > 0 ? `+$${abs}` : `-$${abs}`;
}

/** 0..1 → "62%". Returns "—" for null. */
export function pct(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function fmtDayLabel(d: Date, todayRef: Date = new Date()): string {
  const isToday =
    d.getFullYear() === todayRef.getFullYear() &&
    d.getMonth() === todayRef.getMonth() &&
    d.getDate() === todayRef.getDate();
  const yest = new Date(todayRef);
  yest.setDate(yest.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yest.getFullYear() &&
    d.getMonth() === yest.getMonth() &&
    d.getDate() === yest.getDate();
  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() === todayRef.getFullYear() ? undefined : "numeric",
  });
}

/** Human label for a trade result value. */
export function resultLabel(result: string): string {
  switch (result) {
    case "win":
      return "Win";
    case "loss":
      return "Loss";
    case "breakeven":
      return "Breakeven";
    case "no_trade":
      return "No trade";
    default:
      return result;
  }
}
