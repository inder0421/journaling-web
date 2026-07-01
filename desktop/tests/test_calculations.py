import itertools
import unittest
from datetime import datetime

from journal.calculations import (
    cumulative_losses,
    cumulative_wins,
    current_balance,
    cushion_remaining,
    group_stats,
    local_date_key,
    lockout_state,
    off_criteria,
    on_criteria,
    signed_pnl,
    summarize_by_day,
    sum_pnl,
    today_stats,
    week_start_key,
)
from journal.models import Rules, Trade

RULES = Rules(daily_stop_loss=500, max_trades_per_day=2, starting_balance=50_000, max_drawdown_floor=48_000)

_counter = itertools.count(1)


def make_trade(result, amount, **kwargs) -> Trade:
    n = next(_counter)
    pnl = kwargs.pop("pnl", signed_pnl(amount, result))
    return Trade(
        id=f"t{n}",
        setup_criteria_met=kwargs.pop("setup_criteria_met", True),
        entry_reason=kwargs.pop("entry_reason", ""),
        result=result,
        amount=amount,
        pnl=pnl,
        instrument=kwargs.pop("instrument", "ES"),
        traded_at=kwargs.pop("traded_at", datetime.now().isoformat()),
    )


class TestSignedPnl(unittest.TestCase):
    def test_direction(self):
        self.assertEqual(signed_pnl(300, "win"), 300)
        self.assertEqual(signed_pnl(300, "loss"), -300)
        self.assertEqual(signed_pnl(300, "scratch"), 0)

    def test_ignores_sign_of_input(self):
        self.assertEqual(signed_pnl(-300, "win"), 300)
        self.assertEqual(signed_pnl(-300, "loss"), -300)


class TestDateKeys(unittest.TestCase):
    def test_local_day_key(self):
        self.assertEqual(local_date_key(datetime(2025, 6, 23, 14, 0)), "2025-06-23")

    def test_week_start_key(self):
        # 2025-06-25 is a Wednesday -> week starts Mon 2025-06-23
        self.assertEqual(week_start_key(datetime(2025, 6, 25)), "2025-06-23")
        # Sunday belongs to the week that started the previous Monday
        self.assertEqual(week_start_key(datetime(2025, 6, 29)), "2025-06-23")
        # The following Monday starts a new week
        self.assertEqual(week_start_key(datetime(2025, 6, 30)), "2025-06-30")


class TestMoneyAggregates(unittest.TestCase):
    def setUp(self):
        self.trades = [
            make_trade("win", 400),
            make_trade("loss", 250),
            make_trade("scratch", 0),
            make_trade("loss", 100),
        ]

    def test_sum_pnl(self):
        self.assertEqual(sum_pnl(self.trades), 400 - 250 - 100)

    def test_cumulative_wins_losses(self):
        self.assertEqual(cumulative_wins(self.trades), 400)
        self.assertEqual(cumulative_losses(self.trades), 350)

    def test_balance_and_cushion(self):
        self.assertEqual(current_balance(RULES, self.trades), 50_000 + 50)
        self.assertEqual(cushion_remaining(RULES, self.trades), 2_050)


class TestTodayStats(unittest.TestCase):
    def test_counts_only_today(self):
        now = datetime(2025, 6, 25, 10, 0)
        trades = [
            make_trade("loss", 100, traded_at=datetime(2025, 6, 25, 9, 0).isoformat()),
            make_trade("win", 200, traded_at=datetime(2025, 6, 25, 9, 30).isoformat()),
            make_trade("win", 999, traded_at=datetime(2025, 6, 24, 9, 0).isoformat()),
        ]
        stats = today_stats(trades, now)
        self.assertEqual(stats.trade_count, 2)
        self.assertEqual(stats.pnl, 100)


class TestLockoutState(unittest.TestCase):
    now = datetime(2025, 6, 25, 10, 0)

    @staticmethod
    def at(h):
        return datetime(2025, 6, 25, h, 0).isoformat()

    def test_no_lock_under_limits(self):
        trades = [make_trade("loss", 100, traded_at=self.at(9))]
        self.assertFalse(lockout_state(RULES, trades, self.now).locked)

    def test_daily_stop_exact(self):
        trades = [make_trade("loss", 500, traded_at=self.at(9))]
        state = lockout_state(RULES, trades, self.now)
        self.assertTrue(state.daily_stop_hit)
        self.assertTrue(state.locked)

    def test_max_trades(self):
        trades = [
            make_trade("win", 50, traded_at=self.at(9)),
            make_trade("win", 50, traded_at=self.at(10)),
        ]
        state = lockout_state(RULES, trades, self.now)
        self.assertTrue(state.max_trades_hit)
        self.assertTrue(state.locked)

    def test_floor_breach_overrides_lenient_rules(self):
        lenient = Rules(daily_stop_loss=100_000, max_trades_per_day=100,
                         starting_balance=RULES.starting_balance, max_drawdown_floor=RULES.max_drawdown_floor)
        trades = [make_trade("loss", 2000, traded_at=self.at(9))]
        state = lockout_state(lenient, trades, self.now)
        self.assertTrue(state.floor_breached)
        self.assertTrue(state.locked)

    def test_resets_across_days(self):
        trades = [make_trade("loss", 500, traded_at=datetime(2025, 6, 24, 9, 0).isoformat())]
        self.assertFalse(lockout_state(RULES, trades, self.now).locked)


class TestCriteriaAnalytics(unittest.TestCase):
    def setUp(self):
        self.trades = [
            make_trade("win", 300, setup_criteria_met=True),
            make_trade("win", 200, setup_criteria_met=True),
            make_trade("loss", 150, setup_criteria_met=True),
            make_trade("loss", 400, setup_criteria_met=False),
            make_trade("loss", 300, setup_criteria_met=False),
            make_trade("win", 100, setup_criteria_met=False),
        ]

    def test_split(self):
        self.assertEqual(len(on_criteria(self.trades)), 3)
        self.assertEqual(len(off_criteria(self.trades)), 3)

    def test_win_rate_from_decisive_only(self):
        on = group_stats(on_criteria(self.trades))
        self.assertAlmostEqual(on.win_rate, 2 / 3)
        self.assertEqual(on.net_pnl, 300 + 200 - 150)

        off = group_stats(off_criteria(self.trades))
        self.assertAlmostEqual(off.win_rate, 1 / 3)
        self.assertEqual(off.net_pnl, -400 - 300 + 100)

    def test_null_win_rate_with_no_decisive_trades(self):
        only_scratch = [make_trade("scratch", 0)]
        self.assertIsNone(group_stats(only_scratch).win_rate)


class TestSummarizeByDay(unittest.TestCase):
    def test_groups_flags_and_sorts(self):
        trades = [
            make_trade("loss", 300, traded_at=datetime(2025, 6, 24, 9, 0).isoformat()),
            make_trade("loss", 300, traded_at=datetime(2025, 6, 24, 10, 0).isoformat()),
            make_trade("win", 100, traded_at=datetime(2025, 6, 25, 9, 0).isoformat()),
            make_trade("win", 100, traded_at=datetime(2025, 6, 25, 10, 0).isoformat()),
            make_trade("win", 100, traded_at=datetime(2025, 6, 25, 11, 0).isoformat()),
        ]
        days = summarize_by_day(trades, RULES)
        self.assertEqual([d.key for d in days], ["2025-06-25", "2025-06-24"])

        today, yesterday = days
        self.assertEqual(today.trade_count, 3)
        self.assertTrue(today.exceeded_max_trades)  # 3 > 2
        self.assertEqual(yesterday.net_pnl, -600)
        self.assertTrue(yesterday.hit_daily_stop)  # -600 <= -500


if __name__ == "__main__":
    unittest.main()
