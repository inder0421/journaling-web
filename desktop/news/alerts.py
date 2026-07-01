"""Client-side alert rules. Mirrors src/lib/news/alerts.ts.

We don't have a live quote feed wired up, so "gaps significantly after news"
isn't generated yet ('gap' is reserved in Alert.kind for when a price source is
added) — everything else fires off the enriched news feed itself. Desktop OS
notifications are intentionally left out to keep this stdlib-only; the alert
feed itself (see ui/news_tab.py) is the notification surface.
"""
from __future__ import annotations

from .types import Alert, NewsItem


def derive_alerts(items: list[NewsItem], watchlist: list[str]) -> list[Alert]:
    alerts: list[Alert] = []
    watch = {t.upper() for t in watchlist}

    for item in items:
        if item.importance >= 8:
            alerts.append(Alert(
                id=f"alert-breaking-{item.id}", time=item.time, kind="breaking",
                message=f"Breaking (importance {item.importance}/10): {item.headline}", item=item,
            ))
            continue
        hit_ticker = next((t for t in (item.tickers or []) if t.upper() in watch), None)
        if hit_ticker:
            alerts.append(Alert(
                id=f"alert-watchlist-{item.id}", time=item.time, kind="watchlist",
                message=f"{hit_ticker} news: {item.headline}", item=item,
            ))
            continue
        if "Federal Reserve" in item.categories:
            alerts.append(Alert(
                id=f"alert-fed-{item.id}", time=item.time, kind="fed",
                message=f"Fed: {item.headline}", item=item,
            ))
            continue
        if any(c in item.categories for c in ("Inflation", "Employment", "Economic News")):
            alerts.append(Alert(
                id=f"alert-econ-{item.id}", time=item.time, kind="economic",
                message=f"Economic data: {item.headline}", item=item,
            ))
            continue
        if "Earnings" in item.categories:
            alerts.append(Alert(
                id=f"alert-earn-{item.id}", time=item.time, kind="earnings",
                message=f"Earnings: {item.headline}", item=item,
            ))

    return sorted(alerts, key=lambda a: a.time, reverse=True)
