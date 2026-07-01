"""JSON-file-backed local storage for the desktop app. Mirrors the localStorage
fallback in src/lib/storage.ts — this app is local-only, no cloud sync."""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .models import DEFAULT_RULES, NewTrade, Rules, Trade

DATA_DIR = Path(os.environ.get("TRADING_JOURNAL_HOME", Path.home() / ".trading_journal"))
DATA_FILE = DATA_DIR / "data.json"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


class Store:
    """Loads/saves trades + rules to a single JSON file, atomically."""

    def __init__(self, path: Path = DATA_FILE):
        self.path = path
        self._data = self._read()

    def _read(self) -> dict:
        if not self.path.exists():
            return {"rules": DEFAULT_RULES.to_dict(), "trades": []}
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            return {
                "rules": raw.get("rules", DEFAULT_RULES.to_dict()),
                "trades": raw.get("trades", []),
            }
        except (json.JSONDecodeError, OSError):
            return {"rules": DEFAULT_RULES.to_dict(), "trades": []}

    def _write(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self._data, f, indent=2)
        tmp.replace(self.path)

    def load_rules(self) -> Rules:
        return Rules.from_dict(self._data.get("rules", {}))

    def save_rules(self, rules: Rules) -> Rules:
        rules.updated_at = _now_iso()
        self._data["rules"] = rules.to_dict()
        self._write()
        return rules

    def load_trades(self) -> list[Trade]:
        return [Trade.from_dict(d) for d in self._data.get("trades", [])]

    def add_trade(self, trade: NewTrade) -> Trade:
        full = Trade(
            id=_new_id(),
            setup_criteria_met=trade.setup_criteria_met,
            entry_reason=trade.entry_reason,
            result=trade.result,
            amount=trade.amount,
            pnl=trade.pnl,
            instrument=trade.instrument,
            traded_at=trade.traded_at,
            created_at=_now_iso(),
        )
        trades = self._data.setdefault("trades", [])
        trades.insert(0, full.to_dict())
        self._write()
        return full

    def delete_trade(self, trade_id: str) -> None:
        trades = self._data.get("trades", [])
        self._data["trades"] = [t for t in trades if t.get("id") != trade_id]
        self._write()
