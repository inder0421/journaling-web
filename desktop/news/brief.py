"""Template-driven synthesis of the Morning Brief / Midday Update / Closing Summary.
Mirrors src/lib/news/brief.ts."""
from __future__ import annotations

from typing import Literal, Optional

from .aggregator import top_by_importance
from .types import DailyScore, NewsItem, Sentiment

BriefKind = Literal["morning", "midday", "closing"]

_KIND_LEAD: dict[BriefKind, str] = {
    "morning": "Markets are heading into the open",
    "midday": "Midday, markets are trading",
    "closing": "Markets closed",
}


def _sentiment_tone(label: str) -> str:
    return {
        "Very Bullish": "sharply higher, led by broad risk-on positioning",
        "Bullish": "modestly higher",
        "Neutral": "mixed, lacking a clear catalyst",
        "Bearish": "modestly lower",
        "Very Bearish": "sharply lower amid broad risk-off positioning",
    }[label]


def _sector_sentence(items: list[NewsItem]) -> Optional[str]:
    by_sector: dict[str, list[int]] = {}
    for item in items:
        if not item.sector:
            continue
        bucket = by_sector.setdefault(item.sector, [0, 0])
        if item.sentiment == "Bullish":
            bucket[0] += 1
        if item.sentiment == "Bearish":
            bucket[1] += 1
    if not by_sector:
        return None
    ranked = sorted(by_sector.items(), key=lambda kv: kv[1][0] - kv[1][1], reverse=True)
    leader = ranked[0]
    laggard = ranked[-1]
    if leader is laggard or len(ranked) == 1:
        return f"{leader[0]} is in focus on today's news flow."
    return f"{leader[0]} leads on today's headlines, while {laggard[0]} lags."


def _top_story_sentence(items: list[NewsItem]) -> Optional[str]:
    top = top_by_importance(items, 1)
    if not top:
        return None
    t = top[0]
    return f'The story to watch: "{t.headline}" ({t.sentiment.lower()}, importance {t.importance}/10).'


def _catalyst_sentence(items: list[NewsItem]) -> Optional[str]:
    fed_or_data = next(
        (i for i in items if any(c in i.categories for c in
                                  ("Federal Reserve", "Inflation", "Employment", "Interest Rates"))),
        None,
    )
    if not fed_or_data:
        return None
    return f"Investors remain focused on {fed_or_data.headline.lower()}."


def generate_brief(kind: BriefKind, items: list[NewsItem], score: DailyScore) -> str:
    """Builds the 'Markets are expected to open higher following...' style paragraph."""
    parts = [f"{_KIND_LEAD[kind]} {_sentiment_tone(score.label)}."]
    for sentence in (_sector_sentence(items), _top_story_sentence(items), _catalyst_sentence(items)):
        if sentence:
            parts.append(sentence)
    return " ".join(parts)


def dominant_sentiment(items: list[NewsItem]) -> Sentiment:
    bull = sum(1 for i in items if i.sentiment == "Bullish")
    bear = sum(1 for i in items if i.sentiment == "Bearish")
    if bull > bear:
        return "Bullish"
    if bear > bull:
        return "Bearish"
    return "Neutral"
