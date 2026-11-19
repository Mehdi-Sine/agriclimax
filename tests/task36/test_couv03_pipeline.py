"""SIM checkpoint failure is independent of existing ERA/Journal acquisition."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from era5_export_checkpoint import export


class SimCheckpointTests(unittest.TestCase):
    def test_candidate_checkpoint_without_new_era_day(self):
        with tempfile.TemporaryDirectory() as scratch:
            root, dest = Path(scratch)/'era', Path(scratch)/'export'
            candidate = root/'sim-candidate'
            candidate.mkdir(parents=True)
            raw = b'{"version":"sim-incremental-1","days":{}}'
            (candidate/'index.json').write_bytes(raw)
            report = export(root, dest)
            self.assertFalse(report['exported'])
            self.assertEqual((dest/'sim-candidate/index.json').read_bytes(), raw)

    def test_sim_export_failure_preserves_era_checkpoint(self):
        with tempfile.TemporaryDirectory() as scratch:
            root, dest = Path(scratch)/'era', Path(scratch)/'export'
            candidate = root/'sim-candidate'
            candidate.mkdir(parents=True)
            (candidate/'index.json').write_text('{}')
            (root/'report.json').write_text(json.dumps({'date':'2026-11-07'}))
            day = root/'2026-11-07'
            day.mkdir()
            (day/'exact.json.gz').write_bytes(b'original ERA')
            with patch('era5_export_checkpoint.shutil.copytree', side_effect=OSError):
                self.assertTrue(export(root, dest)['exported'])
            self.assertEqual((dest/'2026-11-07/exact.json.gz').read_bytes(), b'original ERA')
            self.assertEqual((day/'exact.json.gz').read_bytes(), b'original ERA')


class SimRevisionTests(unittest.TestCase):
    def test_old_sim_revision_does_not_block_new_day(self):
        import gzip
        from datetime import date, timedelta
        from types import ModuleType, SimpleNamespace

        import couv03_collect as collector
        from agriclimax.climate.safran import CellWeight
        from agriclimax.climate.safran_incremental import CandidateStore, sha

        today = date(2026, 11, 19)
        old, new = today - timedelta(days=4), today - timedelta(days=1)
        targets = [f"pra:{i}" for i in range(32)]
        rows = [{"DATE": day, "LAMBX": 1, "LAMBY": 1} for day in (old, new)]
        pyarrow = ModuleType("pyarrow")
        parquet = ModuleType("pyarrow.parquet")
        parquet.ParquetFile = lambda _: SimpleNamespace(
            iter_batches=lambda **_: [SimpleNamespace(to_pylist=lambda: rows)]
        )

        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            raw_grid = b"test grid"
            (root / "coordonnees_grille_safran_lambert-2-etendu.csv").write_bytes(raw_grid)
            (root / "weights.json.gz").write_bytes(gzip.compress(json.dumps({"grid_sha256": sha(raw_grid)}).encode()))
            (root / "latest.parquet").write_bytes(b"test source")
            (root / "latest.parquet.receipt.json").write_text(json.dumps({"sha256": sha(b"test source")}))
            (root / "catalogue.json").write_text(json.dumps({"resources": [{
                "title": "QUOT_SIM2_latest", "extras": {"analysis:last-modified-at": "2026-11-19T00:00:00Z"},
            }]}))
            store = CandidateStore(root / "candidate")
            original = [{"pra_id": p, "date": str(old), "variable": v, "partial_value": 8}
                        for p in targets for v in collector.VARIABLES]
            self.assertTrue(store.put(old, original, today=today))
            with (
                patch.dict(sys.modules, {"pyarrow": pyarrow, "pyarrow.parquet": parquet}),
                patch.object(collector, "FROZEN", root),
                patch.object(collector, "weights", return_value=({p: [CellWeight("cell", 1)] for p in targets}, "a" * 64)),
                patch.object(collector.csv, "DictReader", return_value=[{"pra_id": p, "era_fraction": "0"} for p in targets]),
                patch.object(collector, "cell_id", return_value="cell"),
                patch.object(collector, "aggregate", side_effect=lambda p, d, v, *_a, **_k: {
                    "pra_id": p, "date": str(d), "variable": v, "partial_value": 12,
                }),
            ):
                result = collector.collect(root, store, old, new, today)
            self.assertEqual(result["new_day_revisions"], 1)
            self.assertIn("manual campaign", result["excluded_revisions"][str(old)])
            self.assertEqual(store.read(old), original)
            self.assertTrue(store.read(new))


if __name__ == '__main__':
    unittest.main()
