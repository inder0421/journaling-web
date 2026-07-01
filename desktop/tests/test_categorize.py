import unittest

from news.categorize import categorize


class TestCategorize(unittest.TestCase):
    def test_fed_policy(self):
        categories, _ = categorize("Federal Reserve holds interest rates steady, Powell signals caution")
        self.assertIn("Federal Reserve", categories)
        self.assertIn("Interest Rates", categories)

    def test_cpi_is_inflation(self):
        categories, _ = categorize("CPI rises 0.3% in June, above forecasts")
        self.assertIn("Inflation", categories)

    def test_ma_no_sector(self):
        categories, sector = categorize("Acme Corp to acquire Widget Inc in $2B deal")
        self.assertIn("Mergers & Acquisitions", categories)
        self.assertIsNone(sector)

    def test_tech_sector(self):
        categories, sector = categorize("Semiconductor maker unveils new AI chip")
        self.assertIn("Technology", categories)
        self.assertEqual(sector, "Technology")

    def test_fallback(self):
        categories, _ = categorize("Company announces new office location")
        self.assertEqual(categories, ["Market News"])


if __name__ == "__main__":
    unittest.main()
