"""Synthetic orchestration tests; never evidence of actual CDS acquisition."""

import unittest
from datetime import date, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from agriclimax.territories.national_daily import execute, persisted, window


class NationalDailyTests(unittest.TestCase):
    def test_publication_ceiling_includes_next_midnight_for_rain(self):
        self.assertEqual(window(date(2026, 11, 5), date(2026, 10, 29)), [date(2026, 10, 30)])
        with self.assertRaises(ValueError):
            window(date(2026, 11, 5), date(2026, 10, 18), date(2026, 10, 31), date(2026, 10, 31))

    def test_catchup_is_oldest_first_bounded_and_never_skips_an_old_backlog(self):
        self.assertEqual(
            window(date(2026, 11, 5), date(2026, 10, 18)),
            [date(2026, 10, 19) + timedelta(days=i) for i in range(3)],
        )
        with self.assertRaises(ValueError):
            window(date(2026, 11, 5), date(2026, 9, 18))

    def test_no_normal_acquisition_future_or_half_explicit_range(self):
        for start, end in [
            (date(2020, 1, 1), date(2020, 1, 3)),
            (date(2026, 10, 20), None),
            (date(2026, 10, 20), date(2026, 10, 19)),
        ]:
            with self.assertRaises(ValueError):
                window(date(2026, 11, 5), date(2026, 10, 18), start, end)

    def test_contours_are_not_acquisition_and_partial_null_is_valid_persistence(self):
        day = date(2026, 10, 19)
        rows = [
            {"id": "pra:1", "valid_date": str(day), "batch_key": "a", "status": "partial"},
            {"id": "pra:2", "valid_date": None, "batch_key": None},
        ]
        self.assertEqual(persisted(rows, {"pra:1", "pra:2"}, day), {"pra:1"})
        with self.assertRaises(ValueError):
            persisted([rows[0], rows[0]], {"pra:1", "pra:2"}, day)

    def test_replay_uses_destination_proof_and_incomplete_day_is_not_published(self):
        day = date(2026, 10, 19)
        territories = [SimpleNamespace(id=f"pra:{i}") for i in range(3)]
        present = {"pra:0"}

        def read(day):
            return [
                {
                    "id": t.id,
                    "valid_date": str(day) if t.id in present else None,
                    "batch_key": "a" if t.id in present else None,
                    "status": "partial" if t.id in present else "unavailable",
                }
                for t in territories
            ]

        calls = []

        def batch(provider, territory, weights, start, end, root, **kwargs):
            calls.append((territory.id, kwargs["max_downloads"]))
            if kwargs["max_downloads"]:
                present.add(territory.id)
                return {"status": "partial", "downloaded_tiles": 1}
            return {"status": "processing", "downloaded_tiles": 0}

        with patch.dict(
            "sys.modules", {"agriclimax.territories.pipeline": SimpleNamespace(run_batch=batch)}
        ):
            result = execute(
                territories,
                [],
                None,
                Path("unused"),
                [day],
                read,
                lambda envelope: None,
                max_downloads=1,
            )
            self.assertFalse(result["days"][0]["published"])
            self.assertEqual(calls, [("pra:1", 1), ("pra:2", 0)])
            calls.clear()
            result = execute(
                territories,
                [],
                None,
                Path("unused"),
                [day],
                read,
                lambda envelope: None,
                max_downloads=1,
            )
            self.assertTrue(result["days"][0]["published"])
            self.assertEqual(calls, [("pra:2", 1)])
            calls.clear()
            self.assertEqual(
                execute(territories, [], None, Path("unused"), [day], read, lambda envelope: None)[
                    "status"
                ],
                "completed",
            )
            self.assertEqual(calls, [])

    def test_completed_local_checkpoint_cannot_claim_a_missing_destination(self):
        territories = [SimpleNamespace(id=f"pra:{i}") for i in range(3)]

        def read(day):
            return [{"id": t.id} for t in territories]

        with patch.dict(
            "sys.modules",
            {
                "agriclimax.territories.pipeline": SimpleNamespace(
                    run_batch=lambda *args, **kwargs: {"status": "replayed"}
                )
            },
        ), self.assertRaisesRegex(ValueError, "disagrees"):
            execute(
                territories,
                [],
                None,
                Path("unused"),
                [date(2026, 10, 19)],
                read,
                lambda envelope: None,
            )
