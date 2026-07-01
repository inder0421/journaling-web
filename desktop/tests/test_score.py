import unittest

from news.score import compute_daily_score
from news.types import NewsItem


def item(**overrides):
    base = dict(
        id="x", headline="Headline", source="Finnhub", time="2025-01-01T00:00:00+00:00",
        categories=["Market News"], sector=None, ai_summary="Headline",
        sentiment="Neutral", sentiment_confidence=50, importance=5, impact="Medium",
    )
    base.update(overrides)
    return NewsItem(**base)


class TestComputeDailyScore(unittest.TestCase):
    def test_neutral_with_no_stories(self):
        result = compute_daily_score([])
        self.assertEqual(result.score, 50)
        self.assertEqual(result.label, "Neutral")

    def test_above_50_when_bullish_dominates(self):
        result = compute_daily_score([
            item(sentiment="Bullish", sentiment_confidence=90, importance=9),
            item(sentiment="Bullish", sentiment_confidence=80, importance=8),
        ])
        self.assertGreater(result.score, 50)
        self.assertIn(result.label, ("Bullish", "Very Bullish"))

    def test_below_50_when_bearish_dominates(self):
        result = compute_daily_score([
            item(sentiment="Bearish", sentiment_confidence=90, importance=9),
            item(sentiment="Bearish", sentiment_confidence=80, importance=8),
        ])
        self.assertLess(result.score, 50)
        self.assertIn(result.label, ("Bearish", "Very Bearish"))

    def test_clamped_to_0_100(self):
        many = [item(sentiment="Bearish", sentiment_confidence=100, importance=10) for _ in range(20)]
        result = compute_daily_score(many)
        self.assertGreaterEqual(result.score, 0)
        self.assertLessEqual(result.score, 100)


if __name__ == "__main__":
    unittest.main()
