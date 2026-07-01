"""Pure, fully-tested domain logic. No I/O. Mirrors src/lib/calculations.ts."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from .models import Rules, Trade, TradeResult


def signed_pnl(amount: float, result: TradeResult) -> float:
    """Convert an entered magnitude + result into a signed P&L value."""
    mag = abs(amount) if amount else 0.0
    if result == "win":
        return mag
    if result == "loss":
        return -mag
    return 0.0  # scratch / break-even


def _parse(input_: str | datetime) -> datetime:
    if isinstance(input_, datetime):
        return input_
    # Accept ISO 8601 with trailing 'Z'.
    return datetime.fromisoformat(input_.replace("Z", "+00:00"))


def local_date_key(input_: str | datetime) -> str:
    """Calendar day key (YYYY-MM-DD), in local time."""
    d = _parse(input_).astimezone() if isinstance(input_, str) else input_
    return d.strftime("%Y-%m-%d")


def week_start_key(input_: str | datetime) -> str:
    """Local week-start (Monday) key for grouping."""
    d = _parse(input_).astimezone() if isinstance(input_, str) else input_
    monday = d.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=d.weekday())
    return local_date_key(monday)


def trades_on_day(trades: list[Trade], day_key: str) -> list[Trade]:
    return [t for t in trades if local_date_key(t.traded_at) == day_key]


def sum_pnl(trades: list[Trade]) -> float:
    return sum(t.pnl for t in trades)


def cumulative_losses(trades: list[Trade]) -> float:
    """Total dollars lost across all losing trades, returned as a positive number."""
    return sum(-t.pnl for t in trades if t.pnl < 0)


def cumulative_wins(trades: list[Trade]) -> float:
    return sum(t.pnl for t in trades if t.pnl > 0)


def current_balance(rules: Rules, trades: list[Trade]) -> float:
    return rules.starting_balance + sum_pnl(trades)


def cushion_remaining(rules: Rules, trades: list[Trade]) -> float:
    return current_balance(rules, trades) - rules.max_drawdown_floor


def initial_cushion(rules: Rules) -> float:
    return rules.starting_balance - rules.max_drawdown_floor


@dataclass
class DayStats:
    pnl: float
    trade_count: int


def today_stats(trades: list[Trade], now: Optional[datetime] = None) -> DayStats:
    now = now or datetime.now().astimezone()
    today = trades_on_day(trades, local_date_key(now))
    return DayStats(pnl=sum_pnl(today), trade_count=len(today))


@dataclass
class LockoutState:
    locked: bool
    daily_stop_hit: bool
    max_trades_hit: bool
    floor_breached: bool
    today_pnl: float
    today_count: int


def lockout_state(rules: Rules, trades: list[Trade], now: Optional[datetime] = None) -> LockoutState:
    """The enforcement core. Triggers: daily stop reached, max trades reached, or floor breached."""
    stats = today_stats(trades, now)
    daily_stop_hit = rules.daily_stop_loss > 0 and stats.pnl <= -abs(rules.daily_stop_loss)
    max_trades_hit = rules.max_trades_per_day > 0 and stats.trade_count >= rules.max_trades_per_day
    floor_breached = cushion_remaining(rules, trades) <= 0
    return LockoutState(
        locked=daily_stop_hit or max_trades_hit or floor_breached,
        daily_stop_hit=daily_stop_hit,
        max_trades_hit=max_trades_hit,
        floor_breached=floor_breached,
        today_pnl=stats.pnl,
        today_count=stats.trade_count,
    )


@dataclass
class GroupStats:
    count: int
    wins: int
    losses: int
    scratches: int
    net_pnl: float
    win_rate: Optional[float]
    avg_pnl: Optional[float]


def group_stats(trades: list[Trade]) -> GroupStats:
    wins = sum(1 for t in trades if t.result == "win")
    losses = sum(1 for t in trades if t.result == "loss")
    scratches = sum(1 for t in trades if t.result == "scratch")
    decisive = wins + losses
    net_pnl = sum_pnl(trades)
    return GroupStats(
        count=len(trades),
        wins=wins,
        losses=losses,
        scratches=scratches,
        net_pnl=net_pnl,
        win_rate=(wins / decisive) if decisive > 0 else None,
        avg_pnl=(net_pnl / len(trades)) if trades else None,
    )


def on_criteria(trades: list[Trade]) -> list[Trade]:
    return [t for t in trades if t.setup_criteria_met]


def off_criteria(trades: list[Trade]) -> list[Trade]:
    return [t for t in trades if not t.setup_criteria_met]


@dataclass
class PeriodSummary:
    key: str
    trades: list[Trade]
    net_pnl: float
    trade_count: int
    on_criteria_count: int
    impulse_count: int
    exceeded_max_trades: bool
    hit_daily_stop: bool


def _summarize(key: str, day_trades: list[Trade], rules: Rules) -> PeriodSummary:
    sorted_trades = sorted(day_trades, key=lambda t: t.traded_at)
    net_pnl = sum_pnl(day_trades)
    return PeriodSummary(
        key=key,
        trades=sorted_trades,
        net_pnl=net_pnl,
        trade_count=len(day_trades),
        on_criteria_count=len(on_criteria(day_trades)),
        impulse_count=len(off_criteria(day_trades)),
        exceeded_max_trades=rules.max_trades_per_day > 0 and len(day_trades) > rules.max_trades_per_day,
        hit_daily_stop=rules.daily_stop_loss > 0 and net_pnl <= -abs(rules.daily_stop_loss),
    )


def _group_by(trades: list[Trade], key_fn) -> dict[str, list[Trade]]:
    grouped: dict[str, list[Trade]] = {}
    for t in trades:
        grouped.setdefault(key_fn(t), []).append(t)
    return grouped


def summarize_by_day(trades: list[Trade], rules: Rules) -> list[PeriodSummary]:
    """Newest-first list of per-day summaries."""
    grouped = _group_by(trades, lambda t: local_date_key(t.traded_at))
    summaries = [_summarize(key, day_trades, rules) for key, day_trades in grouped.items()]
    return sorted(summaries, key=lambda s: s.key, reverse=True)


def summarize_by_week(trades: list[Trade], rules: Rules) -> list[PeriodSummary]:
    """Newest-first list of per-week (Mon-start) summaries."""
    grouped = _group_by(trades, lambda t: week_start_key(t.traded_at))
    summaries = [_summarize(key, week_trades, rules) for key, week_trades in grouped.items()]
    return sorted(summaries, key=lambda s: s.key, reverse=True)
