import unittest

from news.sources import merge_by_source
from news.types import RawNewsItem, SourceResult


def item(id_):
    return RawNewsItem(id=id_, headline=id_, source="Finnhub", time="2025-01-01T00:00:00+00:00")


class TestMergeBySource(unittest.TestCase):
    def test_combines_multiple_results_for_same_source(self):
        results = [
            SourceResult("Finnhub", True, True, [item("a")]),
            SourceResult("Finnhub", True, True, [item("b")]),
        ]
        merged = merge_by_source(results)
        self.assertEqual(len(merged), 1)
        self.assertEqual([i.id for i in merged[0].items], ["a", "b"])

    def test_surfaces_failure_even_if_sibling_succeeded(self):
        results = [
            SourceResult("SEC EDGAR", True, True, [item("a")]),
            SourceResult("SEC EDGAR", True, False, [], "boom"),
        ]
        merged = merge_by_source(results)
        self.assertEqual(len(merged), 1)
        self.assertFalse(merged[0].ok)
        self.assertEqual(merged[0].error, "boom")

    def test_leaves_distinct_sources_separate(self):
        results = [
            SourceResult("Finnhub", True, True, []),
            SourceResult("Yahoo Finance", False, True, []),
        ]
        self.assertEqual(len(merge_by_source(results)), 2)


if __name__ == "__main__":
    unittest.main()
