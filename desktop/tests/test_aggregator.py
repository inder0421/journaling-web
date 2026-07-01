import unittest
from datetime import datetime, timedelta, timezone

from news.aggregator import aggregate, group_by_category, top_by_importance, within_hours
from news.types import RawNewsItem, SourceResult


def raw(id_, headline, time=None, url=None):
    return RawNewsItem(id=id_, headline=headline, source="Finnhub", time=time or _now(), url=url)


def _now():
    return datetime.now(timezone.utc).isoformat()


def results(items, source="Finnhub"):
    return [SourceResult(source=source, configured=True, ok=True, items=items)]


class TestAggregate(unittest.TestCase):
    def test_dedupes_by_url_across_sources(self):
        t = _now()
        items = aggregate([
            SourceResult("Finnhub", True, True, [raw("a", "Fed holds rates", t, "https://x.test/1")]),
            SourceResult("Yahoo Finance", True, True, [raw("b", "Fed holds rates", t, "https://x.test/1")]),
        ])
        self.assertEqual(len(items), 1)

    def test_dedupes_by_normalized_headline(self):
        items = aggregate(results([
            raw("a", "Fed Holds Rates!"),
            raw("b", "fed holds rates"),
        ]))
        self.assertEqual(len(items), 1)

    def test_sorts_newest_first_and_enriches(self):
        older = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        newer = datetime.now(timezone.utc).isoformat()
        items = aggregate(results([
            raw("a", "Old story", older),
            raw("b", "Federal Reserve raises interest rates", newer),
        ]))
        self.assertEqual(items[0].headline, "Federal Reserve raises interest rates")
        self.assertIn("Federal Reserve", items[0].categories)
        self.assertGreaterEqual(items[0].importance, 1)
        self.assertIn(items[0].sentiment, ("Bullish", "Bearish", "Neutral"))


class TestWithinHours(unittest.TestCase):
    def test_filters_old_stories(self):
        old = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
        items = aggregate(results([raw("a", "Recent"), raw("b", "Old", old)]))
        self.assertEqual(len(within_hours(items, 24)), 1)


class TestGroupByCategory(unittest.TestCase):
    def test_places_story_in_every_matched_category(self):
        items = aggregate(results([raw("a", "Federal Reserve signals higher interest rates ahead")]))
        grouped = group_by_category(items)
        self.assertEqual(len(grouped.get("Federal Reserve", [])), 1)
        self.assertEqual(len(grouped.get("Interest Rates", [])), 1)


class TestTopByImportance(unittest.TestCase):
    def test_returns_highest_importance_first(self):
        items = aggregate(results([
            raw("a", "Company announces new office"),
            raw("b", "Federal Reserve raises interest rates sharply"),
        ]))
        top = top_by_importance(items, 1)
        self.assertEqual(len(top), 1)
        self.assertIn("Federal Reserve", top[0].headline)


if __name__ == "__main__":
    unittest.main()
