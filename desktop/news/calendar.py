"""Economic calendar. Mirrors src/lib/news/calendar.ts.

With FMP_API_KEY set, uses FMP's live calendar (real forecast/previous/actual,
including FOMC/Fed events). Without a key, generates the well-known *recurring*
U.S. releases (CPI, PPI, PCE, NFP, Retail Sales, Consumer Confidence, PMI) from
their standard publication rules and marks them "estimated" — one-off dates
(FOMC meetings, Fed speakers, Treasury auctions) are deliberately not fabricated
since they aren't derivable from a fixed rule; those only appear via a live feed.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

from .sources import fetch_fmp_economic_calendar
from .types import EconomicEvent, Impact


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> datetime:
    """weekday: Monday=0 ... Sunday=6 (Python convention)."""
    d = datetime(year, month, 1, tzinfo=timezone.utc)
    count = 0
    while True:
        if d.weekday() == weekday:
            count += 1
            if count == n:
                return d
        d += timedelta(days=1)


def _last_weekday(year: int, month: int, weekday: int) -> datetime:
    if month == 12:
        d = datetime(year, 12, 31, tzinfo=timezone.utc)
    else:
        d = datetime(year, month + 1, 1, tzinfo=timezone.utc) - timedelta(days=1)
    while d.weekday() != weekday:
        d -= timedelta(days=1)
    return d


def _nth_business_day(year: int, month: int, n: int) -> datetime:
    d = datetime(year, month, 1, tzinfo=timezone.utc)
    count = 0
    while True:
        if d.weekday() < 5:  # Mon-Fri
            count += 1
            if count == n:
                return d
        d += timedelta(days=1)


@dataclass
class _RecurringDef:
    event: str
    importance: int
    impact: Impact
    at: Callable[[int, int], datetime]


# weekday indices: JS Sunday=0..Saturday=6; Python Monday=0..Sunday=6.
# Friday(JS 5) == Friday(Py 4); Tuesday(JS 2) == Tuesday(Py 1).
RECURRING: list[_RecurringDef] = [
    _RecurringDef("Nonfarm Payrolls / Unemployment Rate", 3, "High", lambda y, m: _nth_weekday(y, m, 4, 1)),
    _RecurringDef("CPI (Consumer Price Index)", 3, "High", lambda y, m: _nth_business_day(y, m, 10)),
    _RecurringDef("PPI (Producer Price Index)", 2, "Medium", lambda y, m: _nth_business_day(y, m, 11)),
    _RecurringDef("PCE Price Index", 3, "High", lambda y, m: _last_weekday(y, m, 4)),
    _RecurringDef("Retail Sales", 2, "Medium", lambda y, m: _nth_business_day(y, m, 14)),
    _RecurringDef("ISM Manufacturing PMI", 2, "Medium", lambda y, m: _nth_business_day(y, m, 1)),
    _RecurringDef("ISM Services PMI", 2, "Medium", lambda y, m: _nth_business_day(y, m, 3)),
    _RecurringDef("Consumer Confidence (Conference Board)", 2, "Medium", lambda y, m: _last_weekday(y, m, 1)),
]


def _estimated_events(range_start: datetime, range_end: datetime) -> list[EconomicEvent]:
    months: set[tuple[int, int]] = set()
    d = range_start
    while d <= range_end:
        months.add((d.year, d.month))
        d += timedelta(days=1)

    events: list[EconomicEvent] = []
    for year, month in months:
        for definition in RECURRING:
            date = definition.at(year, month)
            if range_start <= date <= range_end:
                event_time = date.replace(hour=12, minute=30)
                events.append(
                    EconomicEvent(
                        id=f"est-{definition.event}-{date:%Y-%m-%d}",
                        time=event_time.isoformat(),
                        country="US",
                        event=definition.event,
                        importance=definition.importance,
                        impact=definition.impact,
                        estimated=True,
                    )
                )
    return sorted(events, key=lambda e: e.time)


def _fmp_impact(raw: Optional[str]) -> Impact:
    v = (raw or "").lower()
    if v == "high":
        return "High"
    if v == "low":
        return "Low"
    return "Medium"


def _fmp_importance(impact: Impact) -> int:
    return {"High": 3, "Medium": 2, "Low": 1}[impact]


@dataclass
class CalendarResult:
    events: list[EconomicEvent]
    live: bool
    error: Optional[str] = None


def load_economic_calendar(range_start: datetime, range_end: datetime) -> CalendarResult:
    """Fetches the calendar for [range_start, range_end] (inclusive), live where possible."""
    live = fetch_fmp_economic_calendar(f"{range_start:%Y-%m-%d}", f"{range_end:%Y-%m-%d}")

    if not live["configured"]:
        return CalendarResult(events=_estimated_events(range_start, range_end), live=False)
    if not live["ok"]:
        return CalendarResult(events=_estimated_events(range_start, range_end), live=False, error=live.get("error"))

    events: list[EconomicEvent] = []
    for idx, i in enumerate(live["items"]):
        if i.get("country") != "US":
            continue
        impact = _fmp_impact(i.get("impact"))
        events.append(
            EconomicEvent(
                id=f"fmp-{idx}-{i['date']}",
                time=datetime.fromisoformat(i["date"]).isoformat(),
                country=i["country"],
                event=i["event"],
                forecast=str(i["estimate"]) if i.get("estimate") is not None else None,
                previous=str(i["previous"]) if i.get("previous") is not None else None,
                actual=str(i["actual"]) if i.get("actual") is not None else None,
                importance=_fmp_importance(impact),
                impact=impact,
                estimated=False,
            )
        )
    return CalendarResult(events=sorted(events, key=lambda e: e.time), live=True)
