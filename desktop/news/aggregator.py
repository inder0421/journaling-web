"""Merges raw items from every source into enriched, deduped, sorted NewsItem[].
Mirrors src/lib/news/aggregator.ts."""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from .analysis import score_impact, score_importance, score_sentiment, summarize
from .categorize import categorize
from .types import NewsCategory, NewsItem, SourceResult


def _normalize_title(headline: str) -> str:
    lowered = re.sub(r"[^a-z0-9 ]", "", headline.lower())
    return re.sub(r"\s+", " ", lowered).strip()


def _parse_time(iso: str) -> datetime:
    d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _enrich(raw) -> NewsItem:
    text = f"{raw.headline} {raw.summary or ''}"
    categories, sector = categorize(text)
    if raw.provided_sentiment:
        sentiment, confidence = raw.provided_sentiment.label, raw.provided_sentiment.score
    else:
        sentiment, confidence = score_sentiment(text)
    importance = score_importance(text, categories, confidence)
    return NewsItem(
        id=raw.id,
        headline=raw.headline,
        source=raw.source,
        time=raw.time,
        categories=categories,
        sector=sector,
        ai_summary=summarize(raw.headline, raw.summary),
        sentiment=sentiment,
        sentiment_confidence=confidence,
        importance=importance,
        impact=score_impact(importance, confidence),
        summary=raw.summary,
        url=raw.url,
        publisher=raw.publisher,
        tickers=list(raw.tickers or []),
    )


def aggregate(results: list[SourceResult]) -> list[NewsItem]:
    """Combines source results into a single enriched, deduped, newest-first feed."""
    seen: dict[str, NewsItem] = {}
    for result in results:
        for raw in result.items:
            key = raw.url or _normalize_title(raw.headline)
            existing = seen.get(key)
            if existing:
                existing.tickers = list(dict.fromkeys([*existing.tickers, *(raw.tickers or [])]))
                continue
            seen[key] = _enrich(raw)
    return sorted(seen.values(), key=lambda i: _parse_time(i.time), reverse=True)


def within_hours(items: list[NewsItem], hours: float) -> list[NewsItem]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    return [i for i in items if _parse_time(i.time) >= cutoff]


def within_days(items: list[NewsItem], days: float) -> list[NewsItem]:
    return within_hours(items, days * 24)


def group_by_category(items: list[NewsItem]) -> dict[NewsCategory, list[NewsItem]]:
    """Groups items by every category they matched (a story can land in >1 bucket)."""
    grouped: dict[NewsCategory, list[NewsItem]] = {}
    for item in items:
        for cat in item.categories:
            grouped.setdefault(cat, []).append(item)
    return grouped


def top_by_importance(items: list[NewsItem], n: int) -> list[NewsItem]:
    return sorted(items, key=lambda i: i.importance, reverse=True)[:n]
