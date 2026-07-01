import unittest

from news.types import NewsItem
from news.weekly import build_weekly_groups, sector_rotation, story_breakdown


def item(**overrides):
    base = dict(
        id="x", headline="Headline", source="Finnhub", time="2025-01-01T00:00:00+00:00",
        categories=["Market News"], sector=None, ai_summary="Headline",
        sentiment="Neutral", sentiment_confidence=50, importance=5, impact="Medium",
    )
    base.update(overrides)
    return NewsItem(**base)


class TestBuildWeeklyGroups(unittest.TestCase):
    def test_marks_groups_without_source_as_unavailable(self):
        groups = build_weekly_groups([])
        movers = next(g for g in groups if g.key == "movers")
        self.assertTrue(movers.unavailable)
        self.assertEqual(movers.items, [])

    def test_routes_fed_stories(self):
        groups = build_weekly_groups([item(categories=["Federal Reserve"], headline="Fed holds rates")])
        fed = next(g for g in groups if g.key == "fed")
        self.assertEqual(len(fed.items), 1)

    def test_routes_commodity_keywords(self):
        groups = build_weekly_groups([item(headline="Crude oil prices jump on OPEC supply cut")])
        commodities = next(g for g in groups if g.key == "commodities")
        self.assertEqual(len(commodities.items), 1)


class TestSectorRotation(unittest.TestCase):
    def test_tallies_counts_per_sector(self):
        rows = sector_rotation([
            item(sector="Technology", sentiment="Bullish"),
            item(sector="Technology", sentiment="Bearish"),
            item(sector="Energy", sentiment="Bullish"),
        ])
        tech = next(r for r in rows if r.sector == "Technology")
        energy = next(r for r in rows if r.sector == "Energy")
        self.assertEqual((tech.bullish, tech.bearish, tech.neutral), (1, 1, 0))
        self.assertEqual((energy.bullish, energy.bearish, energy.neutral), (1, 0, 0))


class TestStoryBreakdown(unittest.TestCase):
    def test_names_bullish_tickers_as_beneficiaries(self):
        result = story_breakdown(item(sentiment="Bullish", tickers=["AAPL", "MSFT"]))
        self.assertEqual(result.beneficiaries, "AAPL, MSFT")
        self.assertIn("None flagged", result.laggards)


if __name__ == "__main__":
    unittest.main()
