"""Data models for the trade journal. Mirrors src/lib/types.ts."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

TradeResult = Literal["win", "loss", "scratch"]

INSTRUMENTS = ("ES", "NQ", "MES", "MNQ")


@dataclass
class Trade:
    id: str
    setup_criteria_met: bool
    entry_reason: str
    result: TradeResult
    amount: float
    pnl: float
    instrument: str
    traded_at: str  # ISO timestamp
    created_at: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "setup_criteria_met": self.setup_criteria_met,
            "entry_reason": self.entry_reason,
            "result": self.result,
            "amount": self.amount,
            "pnl": self.pnl,
            "instrument": self.instrument,
            "traded_at": self.traded_at,
            "created_at": self.created_at,
        }

    @staticmethod
    def from_dict(d: dict) -> "Trade":
        return Trade(
            id=d["id"],
            setup_criteria_met=d["setup_criteria_met"],
            entry_reason=d.get("entry_reason", ""),
            result=d["result"],
            amount=d["amount"],
            pnl=d["pnl"],
            instrument=d.get("instrument", "ES"),
            traded_at=d["traded_at"],
            created_at=d.get("created_at"),
        )


@dataclass
class NewTrade:
    setup_criteria_met: bool
    entry_reason: str
    result: TradeResult
    amount: float
    pnl: float
    instrument: str
    traded_at: str


@dataclass
class Rules:
    daily_stop_loss: float = 500
    max_trades_per_day: int = 2
    starting_balance: float = 50_000
    max_drawdown_floor: float = 48_000
    updated_at: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "daily_stop_loss": self.daily_stop_loss,
            "max_trades_per_day": self.max_trades_per_day,
            "starting_balance": self.starting_balance,
            "max_drawdown_floor": self.max_drawdown_floor,
            "updated_at": self.updated_at,
        }

    @staticmethod
    def from_dict(d: dict) -> "Rules":
        defaults = Rules()
        return Rules(
            daily_stop_loss=d.get("daily_stop_loss", defaults.daily_stop_loss),
            max_trades_per_day=d.get("max_trades_per_day", defaults.max_trades_per_day),
            starting_balance=d.get("starting_balance", defaults.starting_balance),
            max_drawdown_floor=d.get("max_drawdown_floor", defaults.max_drawdown_floor),
            updated_at=d.get("updated_at"),
        )


DEFAULT_RULES = Rules()
