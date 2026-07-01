import tempfile
import unittest
from pathlib import Path

from journal.models import NewTrade, Rules
from journal.storage import Store


class TestStore(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmpdir.name) / "data.json")

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_defaults_when_no_file_exists(self):
        self.assertEqual(self.store.load_rules(), Rules())
        self.assertEqual(self.store.load_trades(), [])

    def test_add_and_persist_trade(self):
        trade = NewTrade(
            setup_criteria_met=True,
            entry_reason="breakout",
            result="win",
            amount=200,
            pnl=200,
            instrument="ES",
            traded_at="2025-06-25T09:00:00",
        )
        created = self.store.add_trade(trade)
        self.assertTrue(created.id)

        reloaded = Store(self.store.path)
        trades = reloaded.load_trades()
        self.assertEqual(len(trades), 1)
        self.assertEqual(trades[0].entry_reason, "breakout")

    def test_delete_trade(self):
        trade = NewTrade(
            setup_criteria_met=True, entry_reason="", result="loss", amount=100,
            pnl=-100, instrument="ES", traded_at="2025-06-25T09:00:00",
        )
        created = self.store.add_trade(trade)
        self.store.delete_trade(created.id)
        self.assertEqual(self.store.load_trades(), [])

    def test_save_rules_roundtrip(self):
        rules = Rules(daily_stop_loss=700, max_trades_per_day=3, starting_balance=100_000, max_drawdown_floor=95_000)
        self.store.save_rules(rules)
        reloaded = Store(self.store.path).load_rules()
        self.assertEqual(reloaded.daily_stop_loss, 700)
        self.assertEqual(reloaded.max_trades_per_day, 3)


if __name__ == "__main__":
    unittest.main()
