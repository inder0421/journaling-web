import unittest

from news.analysis import score_impact, score_importance, score_sentiment, summarize


class TestScoreSentiment(unittest.TestCase):
    def test_bullish(self):
        label, confidence = score_sentiment("Company beats estimates, raises guidance, shares surge to record high")
        self.assertEqual(label, "Bullish")
        self.assertGreater(confidence, 50)

    def test_bearish(self):
        label, _ = score_sentiment("Company misses estimates, cuts guidance amid lawsuit and layoffs")
        self.assertEqual(label, "Bearish")

    def test_neutral(self):
        label, _ = score_sentiment("Company to present at investor conference next week")
        self.assertEqual(label, "Neutral")


class TestScoreImportance(unittest.TestCase):
    def test_fed_high_base(self):
        score = score_importance("Federal Reserve holds rates steady", ["Federal Reserve"], 70)
        self.assertGreaterEqual(score, 8)

    def test_bounds(self):
        score = score_importance("a" * 10, ["Consumer"], 50)
        self.assertGreaterEqual(score, 1)
        self.assertLessEqual(score, 10)


class TestScoreImpact(unittest.TestCase):
    def test_high(self):
        self.assertEqual(score_impact(9, 90), "High")

    def test_low(self):
        self.assertEqual(score_impact(2, 50), "Low")


class TestSummarize(unittest.TestCase):
    def test_falls_back_to_headline(self):
        self.assertEqual(summarize("Headline only"), "Headline only")

    def test_extracts_first_sentences(self):
        body = (
            "This is the first sentence of the article. This is the second sentence with more detail. "
            "This is a third sentence that should be dropped."
        )
        result = summarize("Headline", body)
        self.assertIn("first sentence", result)
        self.assertIn("second sentence", result)
        self.assertNotIn("third sentence", result)


if __name__ == "__main__":
    unittest.main()
