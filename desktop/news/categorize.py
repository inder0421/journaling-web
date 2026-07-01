"""Keyword-based classification into category buckets + a sector tag.
Mirrors src/lib/news/categorize.ts."""
from __future__ import annotations

import re

from .types import NewsCategory

CATEGORY_KEYWORDS: list[tuple[NewsCategory, re.Pattern]] = [
    ("Federal Reserve", re.compile(r"\b(federal reserve|fomc|fed chair|powell|rate decision|central bank)\b", re.I)),
    ("Interest Rates", re.compile(r"\b(interest rates?|rate hikes?|rate cuts?|basis points|treasury yield|bond yield)\b", re.I)),
    ("Inflation", re.compile(r"\b(inflation|\bcpi\b|\bppi\b|\bpce\b|consumer prices|producer prices)\b", re.I)),
    ("Employment", re.compile(r"\b(nonfarm payrolls|jobs report|unemployment|jobless claims|labor market|hiring)\b", re.I)),
    ("Earnings", re.compile(r"\b(earnings|eps|revenue|quarterly results|guidance|beats estimates|misses estimates)\b", re.I)),
    ("Analyst Upgrades", re.compile(r"\b(upgrades?|upgraded|initiates? .*(buy|outperform|overweight))\b", re.I)),
    ("Analyst Downgrades", re.compile(r"\b(downgrades?|downgraded|initiates? .*(sell|underperform|underweight))\b", re.I)),
    ("Mergers & Acquisitions", re.compile(r"\b(merger|acquisition|acquires?|to acquire|takeover|buyout|deal to buy)\b", re.I)),
    ("FDA Announcements", re.compile(r"\b(fda|clinical trial|drug approval|phase [123]|biologics|recall)\b", re.I)),
    ("SEC Filings", re.compile(r"\b(sec filing|8-k|10-q|10-k|s-1|13d|13g|prospectus)\b", re.I)),
    ("Insider Buying/Selling", re.compile(r"\b(insider (buy|sell|buying|selling)|form 4|director (bought|sold))\b", re.I)),
    ("AI", re.compile(r"\b(artificial intelligence|\bai\b|machine learning|large language model|\bllm\b|generative ai|chatgpt|copilot)\b", re.I)),
    ("Crypto", re.compile(r"\b(crypto|bitcoin|ethereum|blockchain|stablecoin|\bbtc\b|\beth\b|defi)\b", re.I)),
    ("Technology", re.compile(r"\b(software|semiconductor|chip|cloud computing|cybersecurity|smartphone|tech giant)\b", re.I)),
    ("Energy", re.compile(r"\b(crude oil|opec|natural gas|energy prices|oil prices|barrel|renewable energy|solar|drilling)\b", re.I)),
    ("Healthcare", re.compile(r"\b(healthcare|pharma|biotech|hospital|insurer|medicare|medicaid)\b", re.I)),
    ("Financials", re.compile(r"\b(bank|banking|lender|insurer|asset manager|hedge fund|credit rating)\b", re.I)),
    ("Consumer", re.compile(r"\b(retail sales|consumer spending|consumer confidence|e-commerce|retailer)\b", re.I)),
    ("Economic News", re.compile(r"\b(gdp|economic growth|pmi|ism|retail sales|trade deficit|treasury auction|budget deficit)\b", re.I)),
]

SECTOR_BY_CATEGORY: dict[NewsCategory, str] = {
    "Technology": "Technology",
    "AI": "Technology",
    "Energy": "Energy",
    "Healthcare": "Healthcare",
    "Financials": "Financials",
    "Consumer": "Consumer",
    "Crypto": "Crypto",
}


def categorize(text: str) -> tuple[list[NewsCategory], str | None]:
    """Returns every matching category (a story can appear in multiple groups), plus a sector tag."""
    matches = [cat for cat, pattern in CATEGORY_KEYWORDS if pattern.search(text)]
    categories = matches if matches else ["Market News"]
    sector = next((SECTOR_BY_CATEGORY[c] for c in categories if c in SECTOR_BY_CATEGORY), None)
    return categories, sector
