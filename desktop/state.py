"""Shared, observable application state for the Tkinter UI — the desktop analogue
of src/context/AppData.tsx. Widgets subscribe via `on_change` and re-render when
trades/rules/news change; there is no cloud sync here, storage is a local JSON file."""
from __future__ import annotations

from typing import Callable, Optional

from journal.calculations import lockout_state
from journal.models import NewTrade, Rules, Trade
from journal.storage import Store
from news.service import NewsSnapshot
from news.watchlist import load_watchlist, save_watchlist


class AppState:
    def __init__(self) -> None:
        self.store = Store()
        self.rules: Rules = self.store.load_rules()
        self.trades: list[Trade] = self.store.load_trades()
        self.watchlist: list[str] = load_watchlist()
        self.news: Optional[NewsSnapshot] = None
        self.news_loading = False
        self.news_error: Optional[str] = None
        self._seen_alert_ids: set[str] = set()

        self._listeners: list[Callable[[], None]] = []

    def on_change(self, callback: Callable[[], None]) -> None:
        self._listeners.append(callback)

    def _notify(self) -> None:
        for cb in list(self._listeners):
            cb()

    # -------------------------------- journal --------------------------------

    def add_trade(self, trade: NewTrade) -> None:
        created = self.store.add_trade(trade)
        self.trades = [created, *[t for t in self.trades if t.id != created.id]]
        self._notify()

    def delete_trade(self, trade_id: str) -> None:
        self.store.delete_trade(trade_id)
        self.trades = [t for t in self.trades if t.id != trade_id]
        self._notify()

    def save_rules(self, rules: Rules) -> None:
        self.rules = self.store.save_rules(rules)
        self._notify()

    def lockout(self):
        return lockout_state(self.rules, self.trades)

    # --------------------------------- news -----------------------------------

    def set_watchlist(self, tickers: list[str]) -> None:
        self.watchlist = tickers
        save_watchlist(tickers)
        self._notify()

    def set_news_loading(self, loading: bool) -> None:
        self.news_loading = loading
        self._notify()

    def set_news_snapshot(self, snapshot: NewsSnapshot) -> None:
        self.news = snapshot
        self.news_error = None
        self._seen_alert_ids.update(a.id for a in snapshot.alerts)
        self._notify()

    def set_news_error(self, error: str) -> None:
        self.news_error = error
        self._notify()

    @property
    def seen_alert_ids(self) -> set[str]:
        return self._seen_alert_ids
