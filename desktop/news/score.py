"""Daily News Score (0-100): sentiment-weighted rollup of today's stories.
Mirrors src/lib/news/score.ts. We don't have a live market-data feed wired up
(VIX/yields/DXY/breadth), so those factors are omitted rather than faked."""
from __future__ import annotations

from .types import DailyScore, NewsItem, ScoreFactor


def _sentiment_value(item: NewsItem) -> float:
    direction = 1 if item.sentiment == "Bullish" else -1 if item.sentiment == "Bearish" else 0
    return direction * (item.importance / 10) * (item.sentiment_confidence / 100)


def _label_for(score: int) -> str:
    if score >= 80:
        return "Very Bullish"
    if score >= 60:
        return "Bullish"
    if score > 40:
        return "Neutral"
    if score > 20:
        return "Bearish"
    return "Very Bearish"


def compute_daily_score(todays_items: list[NewsItem]) -> DailyScore:
    if not todays_items:
        return DailyScore(
            score=50,
            label="Neutral",
            factors=[ScoreFactor("News volume", "No stories yet today", 0)],
        )

    avg = sum(_sentiment_value(i) for i in todays_items) / len(todays_items)
    score = round(max(0, min(100, 50 + avg * 50)))

    bullish = sum(1 for i in todays_items if i.sentiment == "Bullish")
    bearish = sum(1 for i in todays_items if i.sentiment == "Bearish")
    neutral = len(todays_items) - bullish - bearish
    high_importance = sum(1 for i in todays_items if i.importance >= 8)

    return DailyScore(
        score=score,
        label=_label_for(score),
        factors=[
            ScoreFactor(
                "Corporate & market news sentiment",
                f"{bullish} bullish / {bearish} bearish / {neutral} neutral",
                round(avg * 50),
            ),
            ScoreFactor(
                "High-importance stories today",
                str(high_importance),
                min(10, high_importance * 2) if high_importance > 0 else 0,
            ),
            ScoreFactor("Stories analyzed", str(len(todays_items)), 0),
        ],
    )
