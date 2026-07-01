"""Local watchlist of tickers tracked by the Company News section. Mirrors
src/lib/news/watchlist.ts, persisted to a JSON file instead of localStorage."""
from __future__ import annotations

import json
import os
from pathlib import Path

DEFAULT_WATCHLIST = ["AAPL", "MSFT", "NVDA", "TSLA"]

_HOME = Path(os.environ.get("TRADING_JOURNAL_HOME", Path.home() / ".trading_journal"))
_FILE = _HOME / "news_watchlist.json"


def load_watchlist(path: Path = _FILE) -> list[str]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) and data else list(DEFAULT_WATCHLIST)
    except (OSError, json.JSONDecodeError):
        return list(DEFAULT_WATCHLIST)


def save_watchlist(tickers: list[str], path: Path = _FILE) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(tickers, f, indent=2)


def add_to_watchlist(ticker: str, path: Path = _FILE) -> list[str]:
    clean = ticker.strip().upper()
    current = load_watchlist(path)
    if not clean:
        return current
    if clean not in current:
        current = [*current, clean]
        save_watchlist(current, path)
    return current


def remove_from_watchlist(ticker: str, path: Path = _FILE) -> list[str]:
    current = [t for t in load_watchlist(path) if t != ticker]
    save_watchlist(current, path)
    return current
