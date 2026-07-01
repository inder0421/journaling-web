"""Formatting helpers shared across the UI. Mirrors src/lib/format.ts (subset used
by the desktop app)."""
from __future__ import annotations

from datetime import datetime


def money(n: float) -> str:
    return f"${abs(n):,.0f}" if n >= 0 else f"-${abs(n):,.0f}"


def money_signed(n: float) -> str:
    if n > 0:
        return f"+${n:,.0f}"
    if n < 0:
        return f"-${abs(n):,.0f}"
    return f"${n:,.0f}"


def format_day_key(day_key: str) -> str:
    """'Mon, Jun 23, 2025' from a YYYY-MM-DD local day key. Avoids the non-portable
    '%-d' strftime flag (glibc-only) so this works the same on Windows/macOS/Linux."""
    y, m, d = (int(x) for x in day_key.split("-"))
    dt = datetime(y, m, d)
    return f"{dt.strftime('%a, %b')} {dt.day}, {dt.year}"


def format_time(iso: str) -> str:
    """'3:42 PM' from an ISO timestamp."""
    d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    if d.tzinfo:
        d = d.astimezone()
    hour12 = d.hour % 12 or 12
    return f"{hour12}:{d.minute:02d} {'AM' if d.hour < 12 else 'PM'}"
