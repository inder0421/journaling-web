"""One fetcher per integration, mirroring src/lib/news/sources.ts. Each returns a
SourceResult so the UI can tell "not configured" (missing free API key) apart from
"failed" (network/API error) without one bad source breaking the whole dashboard."""
from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Callable

from .edgar import fetch_company_filings, fetch_recent_filings_by_form
from .http import get_json
from .rss import fetch_feed
from .types import NewsSource, ProvidedSentiment, RawNewsItem, SourceResult


def _not_configured(source: NewsSource) -> SourceResult:
    return SourceResult(source=source, configured=False, ok=True, items=[])


def _failed(source: NewsSource, e: Exception) -> SourceResult:
    return SourceResult(source=source, configured=True, ok=False, items=[], error=str(e))


def _ok(source: NewsSource, items: list[RawNewsItem]) -> SourceResult:
    return SourceResult(source=source, configured=True, ok=True, items=items)


def _safely(source: NewsSource, configured: bool, run: Callable[[], list[RawNewsItem]]) -> SourceResult:
    if not configured:
        return _not_configured(source)
    try:
        return _ok(source, run())
    except Exception as e:  # noqa: BLE001 - one bad source must not break the dashboard
        return _failed(source, e)


def merge_by_source(results: list[SourceResult]) -> list[SourceResult]:
    """Several fetchers share a NewsSource name; merge them into one row per source."""
    by_source: dict[NewsSource, SourceResult] = {}
    for r in results:
        existing = by_source.get(r.source)
        if existing is None:
            by_source[r.source] = SourceResult(r.source, r.configured, r.ok, list(r.items), r.error)
            continue
        existing.items.extend(r.items)
        existing.configured = existing.configured or r.configured
        existing.ok = existing.ok and r.ok
        if not r.ok and not existing.error:
            existing.error = r.error
    return list(by_source.values())


# --------------------------------- Finnhub ---------------------------------

def fetch_finnhub_market_news() -> SourceResult:
    key = os.environ.get("FINNHUB_API_KEY", "").strip()

    def run() -> list[RawNewsItem]:
        data = get_json(f"https://finnhub.io/api/v1/news?category=general&token={key}")
        return [
            RawNewsItem(
                id=f"finnhub-{n['id']}",
                headline=n["headline"],
                summary=n.get("summary"),
                url=n.get("url"),
                source="Finnhub",
                publisher=n.get("source"),
                time=datetime.fromtimestamp(n["datetime"], tz=timezone.utc).isoformat(),
                tickers=[t for t in (n.get("related") or "").split(",") if t],
            )
            for n in data
        ]

    return _safely("Finnhub", bool(key), run)


def fetch_finnhub_company_news(tickers: list[str]) -> SourceResult:
    key = os.environ.get("FINNHUB_API_KEY", "").strip()

    def run() -> list[RawNewsItem]:
        from datetime import timedelta

        to = datetime.now(timezone.utc)
        frm = to - timedelta(days=7)
        items: list[RawNewsItem] = []
        for t in tickers:
            try:
                data = get_json(
                    f"https://finnhub.io/api/v1/company-news?symbol={t}"
                    f"&from={frm:%Y-%m-%d}&to={to:%Y-%m-%d}&token={key}"
                )
            except Exception:
                continue
            for n in data:
                items.append(
                    RawNewsItem(
                        id=f"finnhub-co-{n['id']}",
                        headline=n["headline"],
                        summary=n.get("summary"),
                        url=n.get("url"),
                        source="Finnhub",
                        publisher=n.get("source"),
                        time=datetime.fromtimestamp(n["datetime"], tz=timezone.utc).isoformat(),
                        tickers=[t],
                    )
                )
        return items

    return _safely("Finnhub", bool(key) and len(tickers) > 0, run)


# ----------------------------------- FMP ------------------------------------

def fetch_fmp_stock_news(tickers: list[str]) -> SourceResult:
    key = os.environ.get("FMP_API_KEY", "").strip()

    def run() -> list[RawNewsItem]:
        ticker_param = f"tickers={','.join(tickers)}&" if tickers else ""
        data = get_json(f"https://financialmodelingprep.com/api/v3/stock_news?{ticker_param}limit=50&apikey={key}")
        return [
            RawNewsItem(
                id=f"fmp-{i}-{n['publishedDate']}",
                headline=n["title"],
                summary=n.get("text"),
                url=n.get("url"),
                source="Financial Modeling Prep",
                publisher=n.get("site"),
                time=datetime.fromisoformat(n["publishedDate"]).isoformat(),
                tickers=[n["symbol"]] if n.get("symbol") else [],
            )
            for i, n in enumerate(data)
        ]

    return _safely("Financial Modeling Prep", bool(key), run)


def fetch_fmp_economic_calendar(frm: str, to: str) -> dict:
    key = os.environ.get("FMP_API_KEY", "").strip()
    if not key:
        return {"configured": False, "ok": True, "items": []}
    try:
        items = get_json(f"https://financialmodelingprep.com/api/v3/economic_calendar?from={frm}&to={to}&apikey={key}")
        return {"configured": True, "ok": True, "items": items}
    except Exception as e:  # noqa: BLE001
        return {"configured": True, "ok": False, "error": str(e), "items": []}


# ------------------------------ Alpha Vantage --------------------------------

_AV_TIME_RE = re.compile(r"^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$")


def _parse_av_time(t: str) -> str:
    m = _AV_TIME_RE.match(t)
    if not m:
        return datetime.now(timezone.utc).isoformat()
    y, mo, d, h, mi, s = (int(x) for x in m.groups())
    return datetime(y, mo, d, h, mi, s, tzinfo=timezone.utc).isoformat()


def _map_av_sentiment(label: str) -> str:
    low = label.lower()
    if "bullish" in low:
        return "Bullish"
    if "bearish" in low:
        return "Bearish"
    return "Neutral"


def fetch_alpha_vantage_news(tickers: list[str]) -> SourceResult:
    key = os.environ.get("ALPHA_VANTAGE_API_KEY", "").strip()

    def run() -> list[RawNewsItem]:
        ticker_param = f"&tickers={','.join(tickers)}" if tickers else ""
        data = get_json(f"https://www.alphavantage.co/query?function=NEWS_SENTIMENT{ticker_param}&apikey={key}")
        feed = data.get("feed") or []
        items = []
        for i, n in enumerate(feed):
            items.append(
                RawNewsItem(
                    id=f"av-{i}-{n['time_published']}",
                    headline=n["title"],
                    summary=n.get("summary"),
                    url=n.get("url"),
                    source="Alpha Vantage",
                    publisher=n.get("source"),
                    time=_parse_av_time(n["time_published"]),
                    tickers=[t["ticker"] for t in n.get("ticker_sentiment", [])],
                    provided_sentiment=ProvidedSentiment(
                        label=_map_av_sentiment(n.get("overall_sentiment_label", "")),
                        score=round(50 + n.get("overall_sentiment_score", 0) * 50),
                    ),
                )
            )
        return items

    return _safely("Alpha Vantage", bool(key), run)


# ------------------------------ Yahoo Finance --------------------------------

def fetch_yahoo_finance_news(tickers: list[str]) -> SourceResult:
    def run() -> list[RawNewsItem]:
        items: list[RawNewsItem] = []
        for t in tickers:
            try:
                feed_items = fetch_feed(f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={t}&region=US&lang=en-US")
            except Exception:
                continue
            for i, it in enumerate(feed_items):
                items.append(
                    RawNewsItem(
                        id=f"yahoo-{t}-{i}-{it.pub_date or ''}",
                        headline=it.title,
                        summary=it.description,
                        url=it.link,
                        source="Yahoo Finance",
                        publisher="Yahoo Finance",
                        time=it.pub_date or datetime.now(timezone.utc).isoformat(),
                        tickers=[t],
                    )
                )
        return items

    return _safely("Yahoo Finance", len(tickers) > 0, run)


# ----------------- Federal Reserve / BLS / BEA / SEC (keyless RSS) -----------

def _feed_source(source: NewsSource, url: str, tag: str) -> SourceResult:
    def run() -> list[RawNewsItem]:
        return [
            RawNewsItem(
                id=f"{tag}-{i}-{it.pub_date or it.title}",
                headline=it.title,
                summary=it.description,
                url=it.link,
                source=source,
                publisher=source,
                time=it.pub_date or datetime.now(timezone.utc).isoformat(),
                tickers=[],
            )
            for i, it in enumerate(fetch_feed(url))
        ]

    return _safely(source, True, run)


def fetch_fed_reserve_news() -> SourceResult:
    return _feed_source("Federal Reserve", "https://www.federalreserve.gov/feeds/press_all.xml", "fed")


def fetch_bls_news() -> SourceResult:
    return _feed_source("U.S. Bureau of Labor Statistics", "https://www.bls.gov/feed/bls_latest.rss", "bls")


def fetch_bea_news() -> SourceResult:
    return _feed_source("U.S. Bureau of Economic Analysis", "https://apps.bea.gov/rss/rss.xml", "bea")


def fetch_sec_press_releases() -> SourceResult:
    return _feed_source("SEC EDGAR", "https://www.sec.gov/news/pressreleases.rss", "sec-pr")


# ---------------------------------- SEC EDGAR ---------------------------------

def fetch_edgar_company_filings(tickers: list[str]) -> SourceResult:
    def run() -> list[RawNewsItem]:
        items: list[RawNewsItem] = []
        for t in tickers:
            try:
                items.extend(fetch_company_filings(t))
            except Exception:
                continue
        return items

    return _safely("SEC EDGAR", len(tickers) > 0, run)


def fetch_edgar_recent_8ks() -> SourceResult:
    return _safely("SEC EDGAR", True, lambda: fetch_recent_filings_by_form(["8-K"], 1))
