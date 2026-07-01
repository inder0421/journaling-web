"""Derives an 'AI Trade Impact' read-out for a story. Mirrors src/lib/news/tradeImpact.ts."""
from __future__ import annotations

from .aggregator import top_by_importance
from .types import NewsItem, TradeImpact

SECTOR_BY_CATEGORY: dict[str, list[str]] = {
    "Technology": ["Technology"],
    "AI": ["Technology", "Communication Services"],
    "Energy": ["Energy"],
    "Healthcare": ["Healthcare"],
    "Financials": ["Financials"],
    "Consumer": ["Consumer Discretionary", "Consumer Staples"],
    "Crypto": ["Digital Assets"],
    "Federal Reserve": ["Rate-sensitive equities", "Financials", "Real Estate"],
    "Interest Rates": ["Rate-sensitive equities", "Financials", "Real Estate"],
    "Inflation": ["Consumer Discretionary", "Retail"],
    "Employment": ["Broad market"],
    "Mergers & Acquisitions": ["Deal-target sector"],
    "FDA Announcements": ["Healthcare", "Biotech"],
}


def _affected_sectors(item: NewsItem) -> list[str]:
    sectors: list[str] = []
    for cat in item.categories:
        for s in SECTOR_BY_CATEGORY.get(cat, []):
            if s not in sectors:
                sectors.append(s)
    if item.sector and item.sector not in sectors:
        sectors.append(item.sector)
    return sectors or ["Broad market"]


def _opportunities(item: NewsItem) -> list[str]:
    direction = "upside" if item.sentiment == "Bullish" else "downside" if item.sentiment == "Bearish" else "range-bound"
    ideas: list[str] = []
    if item.tickers:
        ideas.append(f"Directional {direction} setups in {', '.join(item.tickers[:3])} on confirmation.")
    if item.impact == "High":
        ideas.append("Elevated volatility likely — consider wider stops or reduced size around the headline.")
    if "Mergers & Acquisitions" in item.categories:
        ideas.append("Watch for merger-arb spread moves in the target/acquirer pair.")
    if any(c in item.categories for c in ("Federal Reserve", "Interest Rates")):
        ideas.append("Rate-sensitive sectors (financials, real estate, growth tech) may see outsized reaction.")
    if not ideas:
        ideas.append("No clear single-name setup — monitor for follow-through before acting.")
    return ideas


def to_trade_impact(item: NewsItem) -> TradeImpact:
    return TradeImpact(
        item=item,
        sentiment=item.sentiment,
        confidence=item.sentiment_confidence,
        affected_sectors=_affected_sectors(item),
        volatility=item.impact,
        opportunities=_opportunities(item),
    )


def top_trade_impacts(items: list[NewsItem], n: int = 8) -> list[TradeImpact]:
    return [to_trade_impact(i) for i in top_by_importance(items, n)]
