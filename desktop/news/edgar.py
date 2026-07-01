"""SEC EDGAR — free, keyless. Mirrors src/lib/news/edgar.ts.

A desktop process can also set a real, descriptive User-Agent header (SEC's fair
access policy asks for one) — something a browser can't do, so this is a strict
improvement over the web app's equivalent fetch.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from .http import get_json
from .types import RawNewsItem

TICKER_CIK_FALLBACK: dict[str, str] = {
    "AAPL": "0000320193", "MSFT": "0000789019", "GOOGL": "0001652044", "GOOG": "0001652044",
    "AMZN": "0001018724", "NVDA": "0001045810", "TSLA": "0001318605", "META": "0001326801",
    "NFLX": "0001065280", "JPM": "0000019617", "BAC": "0000070858", "XOM": "0000034088",
    "CVX": "0000093410", "JNJ": "0000200406", "PFE": "0000078003", "V": "0001403161",
    "MA": "0001141391", "WMT": "0000104169", "DIS": "0001744489", "KO": "0000021344",
    "PEP": "0000077476", "INTC": "0000050863", "AMD": "0000002488", "CRM": "0001108524",
    "ORCL": "0001341439", "BA": "0000012927", "GS": "0000886982", "UNH": "0000731766",
    "HD": "0000354950", "COST": "0000909832",
}

_ticker_map_cache: Optional[dict[str, str]] = None


def _load_ticker_map() -> dict[str, str]:
    global _ticker_map_cache
    if _ticker_map_cache is not None:
        return _ticker_map_cache
    try:
        data = get_json("https://www.sec.gov/files/company_tickers.json")
        mapping = {entry["ticker"].upper(): str(entry["cik_str"]).zfill(10) for entry in data.values()}
        _ticker_map_cache = mapping
        return mapping
    except Exception:
        _ticker_map_cache = dict(TICKER_CIK_FALLBACK)
        return _ticker_map_cache


def ticker_to_cik(ticker: str) -> Optional[str]:
    upper = ticker.upper()
    if upper in TICKER_CIK_FALLBACK:
        return TICKER_CIK_FALLBACK[upper]
    return _load_ticker_map().get(upper)


def fetch_company_filings(ticker: str, limit: int = 10) -> list[RawNewsItem]:
    """Recent 8-K/10-Q/10-K/Form-4 filings for one ticker, newest first."""
    cik = ticker_to_cik(ticker)
    if not cik:
        return []
    data = get_json(f"https://data.sec.gov/submissions/CIK{cik}.json")
    recent = data["filings"]["recent"]
    forms, dates, accessions, docs = recent["form"], recent["filingDate"], recent["accessionNumber"], recent["primaryDocument"]

    items: list[RawNewsItem] = []
    for i in range(len(forms)):
        if len(items) >= limit:
            break
        accession = accessions[i].replace("-", "")
        items.append(
            RawNewsItem(
                id=f"edgar-{cik}-{accessions[i]}",
                headline=f"{ticker} files Form {forms[i]}",
                summary=f"{ticker} (CIK {cik}) filed a Form {forms[i]} with the SEC on {dates[i]}.",
                url=f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession}/{docs[i]}",
                source="SEC EDGAR",
                publisher="SEC EDGAR",
                time=datetime.fromisoformat(dates[i]).replace(tzinfo=timezone.utc).isoformat(),
                tickers=[ticker],
            )
        )
    return items


def fetch_recent_filings_by_form(forms: list[str], days: int = 1) -> list[RawNewsItem]:
    """Cross-company recent filings for a set of forms (e.g. 8-K) — feeds the 'SEC Filings' bucket."""
    from datetime import timedelta

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    params = "&".join(
        [
            f"forms={','.join(forms)}",
            "dateRange=custom",
            f"startdt={start.strftime('%Y-%m-%d')}",
            f"enddt={end.strftime('%Y-%m-%d')}",
        ]
    )
    data = get_json(f"https://efts.sec.gov/LATEST/search-index?{params}")
    hits = (data.get("hits") or {}).get("hits") or []
    items: list[RawNewsItem] = []
    for hit in hits:
        source = hit["_source"]
        name = (source.get("display_names") or ["Unknown filer"])[0]
        items.append(
            RawNewsItem(
                id=f"edgar-fts-{hit['_id']}",
                headline=f"{name}: Form {source['file_type']} filed",
                source="SEC EDGAR",
                publisher="SEC EDGAR",
                time=datetime.fromisoformat(source["file_date"]).replace(tzinfo=timezone.utc).isoformat(),
                tickers=[],
            )
        )
    return items
