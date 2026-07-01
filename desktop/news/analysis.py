"""
Lightweight, dependency-free NLP: keyword-weighted sentiment/importance scoring.
Mirrors src/lib/news/analysis.ts exactly (same lexicons/formulas) so the desktop
and web dashboards score the same story the same way.
"""
from __future__ import annotations

import re
from typing import Optional

from .types import Impact, NewsCategory, Sentiment

POSITIVE_WORDS: dict[str, int] = {
    "surge": 2, "surges": 2, "surged": 2, "soar": 2, "soars": 2, "soared": 2,
    "rally": 2, "rallies": 2, "rallied": 2,
    "beat": 2, "beats": 2, "beat estimates": 3, "tops estimates": 3,
    "record": 2, "all-time high": 3,
    "upgrade": 2, "upgraded": 2, "outperform": 2,
    "raises guidance": 3, "raised guidance": 3,
    "approval": 2, "approved": 2, "breakthrough": 3, "profit": 1, "profits": 1,
    "growth": 1, "expands": 1, "expansion": 1, "buyback": 2, "dividend": 1,
    "raises dividend": 3, "bullish": 2, "optimistic": 1, "strong": 1, "strength": 1,
    "gains": 1, "gain": 1, "jumps": 2, "jumped": 2, "climbs": 1, "climbed": 1,
    "boom": 2, "robust": 1, "exceeds": 2, "outperforms": 2, "win": 1, "wins": 1,
    "partnership": 1, "acquires": 1, "acquisition": 1, "resilient": 1,
    "recovery": 1, "rebound": 1, "better-than-expected": 2, "easing": 1,
}

NEGATIVE_WORDS: dict[str, int] = {
    "plunge": 2, "plunges": 2, "plunged": 2, "slump": 2, "slumps": 2, "slumped": 2,
    "tumble": 2, "tumbles": 2, "tumbled": 2,
    "miss": 2, "misses": 2, "misses estimates": 3, "falls short": 2,
    "downgrade": 2, "downgraded": 2, "underperform": 2,
    "cuts guidance": 3, "lowers guidance": 3, "cuts forecast": 3,
    "recall": 2, "lawsuit": 2, "investigation": 2, "probe": 2, "fraud": 3,
    "bankruptcy": 3, "layoffs": 2, "job cuts": 2, "mass layoffs": 3,
    "decline": 1, "declines": 1, "declined": 1, "falls": 1, "fell": 1,
    "drop": 1, "drops": 1, "dropped": 1, "weak": 1, "weakness": 1,
    "losses": 1, "loss": 1, "bearish": 2, "pessimistic": 1,
    "plummets": 2, "plummeted": 2, "warns": 1, "warning": 1, "sued": 2,
    "halted": 2, "halt": 2, "breach": 2, "hack": 2, "recession": 2,
    "slowdown": 1, "contraction": 2, "default": 2, "delisted": 2,
    "shortfall": 2, "disappointing": 2,
}

HIGH_IMPACT_KEYWORDS = [
    "federal reserve", "fomc", "rate hike", "rate cut", "interest rate", "powell",
    "cpi", "inflation", "ppi", "pce", "nonfarm payrolls", "jobs report", "unemployment rate",
    "merger", "acquisition", "acquire", "takeover", "buyout",
    "fda approval", "fda approves", "clinical trial", "recall",
    "bankruptcy", "earnings", "guidance", "stock split", "buyback",
    "sec filing", "8-k", "10-q", "10-k", "insider", "data breach",
]

CATEGORY_BASE_IMPORTANCE: dict[NewsCategory, int] = {
    "Federal Reserve": 9,
    "Interest Rates": 8,
    "Inflation": 8,
    "Employment": 8,
    "Economic News": 6,
    "Mergers & Acquisitions": 7,
    "FDA Announcements": 7,
    "Earnings": 6,
    "Analyst Upgrades": 5,
    "Analyst Downgrades": 5,
    "SEC Filings": 4,
    "Insider Buying/Selling": 4,
    "Market News": 4,
    "Technology": 4,
    "Energy": 4,
    "Healthcare": 4,
    "Financials": 4,
    "Consumer": 3,
    "AI": 4,
    "Crypto": 4,
}


def _count_matches(text: str, lexicon: dict[str, int]) -> int:
    total = 0
    for phrase, weight in lexicon.items():
        pattern = r"\b" + re.escape(phrase) + r"\b"
        total += len(re.findall(pattern, text, re.IGNORECASE)) * weight
    return total


def score_sentiment(text: str) -> tuple[Sentiment, int]:
    """Net sentiment classification + a 0-100 confidence score, from headline+summary text."""
    lower = text.lower()
    pos = _count_matches(lower, POSITIVE_WORDS)
    neg = _count_matches(lower, NEGATIVE_WORDS)
    net = pos - neg
    magnitude = min(1.0, abs(net) / 6)
    confidence = round(50 + magnitude * 45)

    if abs(net) < 1:
        return "Neutral", round(50 + magnitude * 10)
    return ("Bullish" if net > 0 else "Bearish"), confidence


def score_importance(text: str, categories: list[NewsCategory], sentiment_confidence: int) -> int:
    """1-10 importance score from category weight, keyword hits, and sentiment magnitude."""
    lower = text.lower()
    base = max([3] + [CATEGORY_BASE_IMPORTANCE.get(c, 3) for c in categories])
    keyword_hits = sum(1 for kw in HIGH_IMPACT_KEYWORDS if kw in lower)
    confidence_boost = (sentiment_confidence - 50) / 50  # -1..1
    raw = base + keyword_hits * 0.6 + confidence_boost
    return max(1, min(10, round(raw)))


def score_impact(importance: int, sentiment_confidence: int) -> Impact:
    """Expected market impact from importance + how strongly the market is likely to react."""
    weight = importance + (sentiment_confidence - 50) / 20
    if weight >= 8:
        return "High"
    if weight >= 5:
        return "Medium"
    return "Low"


def summarize(headline: str, body: Optional[str] = None) -> str:
    """Extractive one-to-two sentence summary — no external LLM call required."""
    source = (body or "").strip()
    if not source:
        return headline.strip()
    collapsed = re.sub(r"\s+", " ", source)
    sentences = [s for s in re.split(r"(?<=[.!?])\s+", collapsed) if len(s) > 20]
    if not sentences:
        return headline.strip()
    picked = " ".join(sentences[:2])
    return f"{picked[:317]}..." if len(picked) > 320 else picked
