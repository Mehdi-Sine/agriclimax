"""Daily comparison must detect losses across different calendar cycles."""
import copy
import unittest

from scripts.core01_monitor import compare


class CoverageMonitorTest(unittest.TestCase):
    def test_new_cycle_drop_and_gap(self):
        baseline = {"counts": [{"usage": "wheat", "indicator": "rain", "nature": "forecast",
                                "period": ["2026-11-08", "2026-11-08"],
                                "after": {"native_complete": 713}}],
                    "archive_dates": ["2026-11-01", "2026-11-02"], "regressions": []}
        current = copy.deepcopy(baseline)
        current["counts"][0]["period"] = ["2026-11-09", "2026-11-09"]
        self.assertEqual(compare(current, baseline), [])
        current["counts"][0]["after"] = {"native_complete": 700, "unknown": 13}
        self.assertTrue(any("coverage drop" in issue for issue in compare(current, baseline)))
        current["archive_dates"] = ["2026-11-01", "2026-11-03"]
        self.assertIn("discontinuous historical calendar", compare(current, baseline))
