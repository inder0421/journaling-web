"""Orchestrates every source + calendar + score/alerts fetch into one snapshot.
The desktop analogue of src/lib/news/useNews.ts, but synchronous — the UI layer
is responsible for calling this off the main thread."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

from .aggregator import aggregate, within_days, within_hours
from .alerts import derive_alerts
from .calendar import CalendarResult, load_economic_calendar
from .score import compute_daily_score
from .sources import (
    fetch_alpha_vantage_news,
    fetch_bea_news,
    fetch_bls_news,
    fetch_edgar_company_filings,
    fetch_edgar_recent_8ks,
    fetch_fed_reserve_news,
    fetch_finnhub_company_news,
    fetch_finnhub_market_news,
    fetch_fmp_stock_news,
    fetch_sec_press_releases,
    fetch_yahoo_finance_news,
    merge_by_source,
)
from .types import Alert, DailyScore, NewsItem, SourceResult


@dataclass
class NewsSnapshot:
    fetched_at: datetime
    all_items: list[NewsItem]
    todays_items: list[NewsItem]
    week_items: list[NewsItem]
    source_statuses: list[SourceResult]
    calendar_today: CalendarResult
    calendar_tomorrow: CalendarResult
    calendar_week: CalendarResult
    daily_score: DailyScore
    alerts: list[Alert] = field(default_factory=list)

    def company_items(self, ticker: str) -> list[NewsItem]:
        upper = ticker.upper()
        return [i for i in self.all_items if any(t.upper() == upper for t in (i.tickers or []))]


def _day_bounds(now: Optional[datetime] = None):
    now = now or datetime.now(timezone.utc)
    start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_today = start_today + timedelta(days=1) - timedelta(seconds=1)
    start_tomorrow = start_today + timedelta(days=1)
    end_tomorrow = start_tomorrow + timedelta(days=1) - timedelta(seconds=1)
    end_week = start_today + timedelta(days=7) - timedelta(seconds=1)
    return start_today, end_today, start_tomorrow, end_tomorrow, end_week


def fetch_news_snapshot(watchlist: list[str], previous_alert_ids: Optional[set[str]] = None) -> NewsSnapshot:
    """Fetches every source + the calendar and returns one consistent snapshot.
    Runs sequentially (simple, dependency-free); call from a background thread."""
    results = [
        fetch_finnhub_market_news(),
        fetch_finnhub_company_news(watchlist),
        fetch_fmp_stock_news([]),
        fetch_fmp_stock_news(watchlist),
        fetch_alpha_vantage_news(watchlist),
        fetch_yahoo_finance_news(watchlist),
        fetch_edgar_company_filings(watchlist),
        fetch_edgar_recent_8ks(),
        fetch_fed_reserve_news(),
        fetch_bls_news(),
        fetch_bea_news(),
        fetch_sec_press_releases(),
    ]
    source_statuses = merge_by_source(results)
    all_items = aggregate(results)

    today_items = within_hours(all_items, 24)
    week_items = within_days(all_items, 7)

    previous_alert_ids = previous_alert_ids or set()
    alerts = [a for a in derive_alerts(today_items, watchlist) if a.id not in previous_alert_ids]

    start_today, end_today, start_tomorrow, end_tomorrow, end_week = _day_bounds()
    calendar_today = load_economic_calendar(start_today, end_today)
    calendar_tomorrow = load_economic_calendar(start_tomorrow, end_tomorrow)
    calendar_week = load_economic_calendar(start_today, end_week)

    return NewsSnapshot(
        fetched_at=datetime.now(timezone.utc),
        all_items=all_items,
        todays_items=today_items,
        week_items=week_items,
        source_statuses=source_statuses,
        calendar_today=calendar_today,
        calendar_tomorrow=calendar_tomorrow,
        calendar_week=calendar_week,
        daily_score=compute_daily_score(today_items),
        alerts=alerts,
    )
