import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from news.calendar import load_economic_calendar


class TestLoadEconomicCalendarNoKey(unittest.TestCase):
    def setUp(self):
        patcher = patch(
            "news.calendar.fetch_fmp_economic_calendar",
            return_value={"configured": False, "ok": True, "items": []},
        )
        self.addCleanup(patcher.stop)
        patcher.start()

    def test_falls_back_to_estimated_schedule(self):
        start = datetime(2026, 7, 1, tzinfo=timezone.utc)
        end = datetime(2026, 7, 31, 23, 59, 59, tzinfo=timezone.utc)
        result = load_economic_calendar(start, end)

        self.assertFalse(result.live)
        self.assertGreater(len(result.events), 0)
        self.assertTrue(all(e.estimated for e in result.events))
        self.assertEqual([e.time for e in result.events], sorted(e.time for e in result.events))

    def test_includes_nfp_on_first_friday(self):
        start = datetime(2026, 7, 1, tzinfo=timezone.utc)
        end = datetime(2026, 7, 31, 23, 59, 59, tzinfo=timezone.utc)
        result = load_economic_calendar(start, end)
        nfp = next((e for e in result.events if "Nonfarm Payrolls" in e.event), None)
        self.assertIsNotNone(nfp)
        day = datetime.fromisoformat(nfp.time).weekday()
        self.assertEqual(day, 4)  # Friday (Python convention: Monday=0)

    def test_narrow_window_with_no_recurring_release(self):
        start = datetime(2026, 7, 22, tzinfo=timezone.utc)
        end = datetime(2026, 7, 22, 23, 59, 59, tzinfo=timezone.utc)
        result = load_economic_calendar(start, end)
        self.assertEqual(len(result.events), 0)


if __name__ == "__main__":
    unittest.main()
