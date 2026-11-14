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


if __name__ == '__main__':
    unittest.main()
