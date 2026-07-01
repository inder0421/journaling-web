"""'This Week's News' uses a different grouping than 'Today's News' (per spec) — some
buckets (Largest Stock Movers, Global Markets) need a live quotes/international feed
we don't have wired up, so those groups say so plainly instead of showing fake rows.
Mirrors src/lib/news/weekly.ts."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from .aggregator import top_by_importance
from .types import NewsItem

COMMODITY_RE = re.compile(r"\b(crude|oil|gold|silver|natural gas|opec|barrel|copper|wheat|commodit)", re.I)
POLICY_RE = re.compile(
    r"\b(congress|white house|tariff|regulation|regulatory|policy|treasury department|antitrust|legislation|executive order|sanction)",
    re.I,
)
GEOPOLITICAL_RE = re.compile(r"\b(war|conflict|sanctions|geopolitical|invasion|ceasefire|trade war|military)", re.I)


@dataclass
class WeeklyGroup:
    key: str
    label: str
    items: list[NewsItem]
    unavailable: Optional[str] = None


def _has(pattern: re.Pattern):
    return lambda i: bool(pattern.search(f"{i.headline} {i.summary or ''}"))


def build_weekly_groups(week_items: list[NewsItem]) -> list[WeeklyGroup]:
    return [
        WeeklyGroup("top-market", "Top Market Stories",
                    top_by_importance([i for i in week_items if "Market News" in i.categories], 8)),
        WeeklyGroup("top-economic", "Top Economic Events",
                    top_by_importance(
                        [i for i in week_items if any(c in i.categories for c in
                                                       ("Economic News", "Inflation", "Employment", "Interest Rates"))],
                        8)),
        WeeklyGroup("fed", "Federal Reserve",
                    top_by_importance([i for i in week_items if "Federal Reserve" in i.categories], 6)),
        WeeklyGroup("earnings", "Major Earnings",
                    top_by_importance([i for i in week_items if "Earnings" in i.categories], 8)),
        WeeklyGroup("movers", "Largest Stock Movers", [],
                    unavailable="Requires a live quotes feed (not configured) — connect Finnhub/FMP to enable."),
        WeeklyGroup("sector-rotation", "Sector Rotation",
                    top_by_importance([i for i in week_items if i.sector], 10)),
        WeeklyGroup("commodities", "Commodities",
                    top_by_importance(list(filter(_has(COMMODITY_RE), week_items)), 6)),
        WeeklyGroup("crypto", "Crypto",
                    top_by_importance([i for i in week_items if "Crypto" in i.categories], 6)),
        WeeklyGroup("global", "Global Markets", [],
                    unavailable="Requires an international markets feed (not configured)."),
        WeeklyGroup("policy", "Government Policy",
                    top_by_importance(list(filter(_has(POLICY_RE), week_items)), 6)),
        WeeklyGroup("geopolitical", "Geopolitical Events",
                    top_by_importance(list(filter(_has(GEOPOLITICAL_RE), week_items)), 6)),
    ]


@dataclass
class SectorRotationRow:
    sector: str
    bullish: int = 0
    bearish: int = 0
    neutral: int = 0


def sector_rotation(week_items: list[NewsItem]) -> list[SectorRotationRow]:
    by_sector: dict[str, SectorRotationRow] = {}
    for item in week_items:
        if not item.sector:
            continue
        row = by_sector.setdefault(item.sector, SectorRotationRow(item.sector))
        if item.sentiment == "Bullish":
            row.bullish += 1
        elif item.sentiment == "Bearish":
            row.bearish += 1
        else:
            row.neutral += 1
    return sorted(by_sector.values(), key=lambda r: r.bullish - r.bearish, reverse=True)


@dataclass
class StoryBreakdown:
    what: str
    why: str
    sectors: str
    beneficiaries: str
    laggards: str


def story_breakdown(item: NewsItem) -> StoryBreakdown:
    """'What happened / why it matters / sectors / beneficiaries / laggards' for one story."""
    sector_list = item.sector if item.sector else ", ".join(item.categories)
    if item.impact == "High":
        why = "High expected market impact — likely to move related names and could shift sector positioning."
    elif item.impact == "Medium":
        why = "Moderate expected market impact — worth tracking for follow-through."
    else:
        why = "Low expected market impact — background context rather than a catalyst."

    if item.sentiment == "Bullish" and item.tickers:
        beneficiaries = ", ".join(item.tickers)
    elif item.sentiment == "Bullish":
        beneficiaries = f"Companies exposed to {sector_list}"
    else:
        beneficiaries = "None flagged — story is not bullish for named tickers."

    if item.sentiment == "Bearish" and item.tickers:
        laggards = ", ".join(item.tickers)
    elif item.sentiment == "Bearish":
        laggards = f"Companies exposed to {sector_list}"
    else:
        laggards = "None flagged — story is not bearish for named tickers."

    return StoryBreakdown(what=item.headline, why=why, sectors=sector_list, beneficiaries=beneficiaries, laggards=laggards)
