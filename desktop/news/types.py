"""Shared types for the News Intelligence Engine. Mirrors src/lib/news/types.ts."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional

Sentiment = Literal["Bullish", "Bearish", "Neutral"]
Impact = Literal["Low", "Medium", "High"]

NewsCategory = Literal[
    "Market News",
    "Economic News",
    "Federal Reserve",
    "Inflation",
    "Employment",
    "Interest Rates",
    "Earnings",
    "Analyst Upgrades",
    "Analyst Downgrades",
    "Mergers & Acquisitions",
    "FDA Announcements",
    "SEC Filings",
    "Insider Buying/Selling",
    "Technology",
    "Energy",
    "Healthcare",
    "Financials",
    "Consumer",
    "AI",
    "Crypto",
]

NEWS_CATEGORIES: tuple[NewsCategory, ...] = (
    "Market News",
    "Economic News",
    "Federal Reserve",
    "Inflation",
    "Employment",
    "Interest Rates",
    "Earnings",
    "Analyst Upgrades",
    "Analyst Downgrades",
    "Mergers & Acquisitions",
    "FDA Announcements",
    "SEC Filings",
    "Insider Buying/Selling",
    "Technology",
    "Energy",
    "Healthcare",
    "Financials",
    "Consumer",
    "AI",
    "Crypto",
)

NewsSource = Literal[
    "Finnhub",
    "Yahoo Finance",
    "SEC EDGAR",
    "Financial Modeling Prep",
    "Alpha Vantage",
    "Federal Reserve",
    "U.S. Bureau of Labor Statistics",
    "U.S. Bureau of Economic Analysis",
    "RSS",
]


@dataclass
class ProvidedSentiment:
    label: Sentiment
    score: int


@dataclass
class RawNewsItem:
    """Raw item shape returned by a source fetcher, before category/AI enrichment."""

    id: str
    headline: str
    source: NewsSource
    time: str  # ISO timestamp
    summary: Optional[str] = None
    url: Optional[str] = None
    publisher: Optional[str] = None
    tickers: list[str] = field(default_factory=list)
    provided_sentiment: Optional[ProvidedSentiment] = None


@dataclass
class NewsItem:
    """A story after category/sentiment/importance/impact enrichment."""

    id: str
    headline: str
    source: NewsSource
    time: str
    categories: list[NewsCategory]
    sector: Optional[str]
    ai_summary: str
    sentiment: Sentiment
    sentiment_confidence: int
    importance: int
    impact: Impact
    summary: Optional[str] = None
    url: Optional[str] = None
    publisher: Optional[str] = None
    tickers: list[str] = field(default_factory=list)


@dataclass
class SourceResult:
    source: NewsSource
    configured: bool
    ok: bool
    items: list[RawNewsItem]
    error: Optional[str] = None


@dataclass
class EconomicEvent:
    id: str
    time: str
    country: str
    event: str
    importance: int  # 1-3
    impact: Impact
    estimated: bool
    forecast: Optional[str] = None
    previous: Optional[str] = None
    actual: Optional[str] = None


@dataclass
class ScoreFactor:
    label: str
    value: str
    contribution: float


@dataclass
class DailyScore:
    score: int
    label: Literal["Very Bullish", "Bullish", "Neutral", "Bearish", "Very Bearish"]
    factors: list[ScoreFactor]


@dataclass
class TradeImpact:
    item: NewsItem
    sentiment: Sentiment
    confidence: int
    affected_sectors: list[str]
    volatility: Impact
    opportunities: list[str]


@dataclass
class Alert:
    id: str
    time: str
    kind: Literal["breaking", "watchlist", "economic", "fed", "earnings", "gap"]
    message: str
    item: Optional[NewsItem] = None
