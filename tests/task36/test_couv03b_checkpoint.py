"""Durability failures must preserve local candidates and all published pointers."""
import csv
import json
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from agriclimax.climate.safran import VARIABLES, CellWeight, aggregate
from agriclimax.climate.safran_incremental import CandidateStore, sha
from couv03b_checkpoint import PREFIX, restore, save
from pra_weather_store import BUCKET


class Remote:
    def __init__(self):
        self.objects = {}
        self.requests = 0
        self.writes = 0
        self.public = False
        self.fail_blob = False

    def request(self, path):
        self.requests += 1
        assert path == 'bucket'
        return json.dumps([{'id': BUCKET, 'public': self.public}]).encode()

    def put_immutable(self, path, raw):
        assert path.startswith(PREFIX + '/')
        assert '/blobs/' in path or '/checkpoints/' in path
        self.requests += 1
        if path in self.objects:
            assert self.objects[path] == raw
            return False
        self.objects[path] = raw
        self.writes += 1
        return True

    def blob(self, path, checksum):
        assert path.startswith(PREFIX + '/')
        raw = self.objects[path]
        if self.fail_blob and '/blobs/' in path:
            raw = b'corrupt'
        if sha(raw) != checksum:
            raise ValueError('checksum mismatch')
        return raw


def fixture(root):
    inventory = csv.DictReader(Path('docs/codex/COUV-02/evidence/national-713.csv').read_text().splitlines())
    targets = sorted(r['pra_id'] for r in inventory if float(r['era_fraction']) < .9)
    day = date(2026, 11, 13)
    rows = [aggregate(pra, day, variable, [CellWeight('a', .97)],
                      {'a': {'T': 12, 'PRELIQ': 1, 'PRENEI': 0, 'HU': 70,
                             'TINF_H': 10, 'TSUP_H': 14}}, source_sha256='a'*64,
                      support_sha256='b'*64, acquired_at='2026-11-14T08:00:00Z')
            for pra in targets for variable in VARIABLES]
    CandidateStore(root).put(day, rows, today=date(2026, 11, 15))
    (root/'report.json').write_text(json.dumps({'pra_count': 32,
        'indicator_eligible': False, 'journal_eligible': False}))


class CheckpointTests(unittest.TestCase):
    def test_save_restore_idempotence_and_published_namespace_isolation(self):
        with tempfile.TemporaryDirectory() as temp:
            root, restored = Path(temp)/'candidate', Path(temp)/'restored'
            fixture(root)
            remote = Remote()
            receipt = save(root, remote)
            writes = remote.writes
            self.assertEqual(save(root, remote)['checkpoint_sha256'], receipt['checkpoint_sha256'])
            self.assertEqual(remote.writes, writes)
            restore(restored, receipt['checkpoint_sha256'], remote)
            self.assertEqual((restored/'index.json').read_bytes(), (root/'index.json').read_bytes())
            self.assertEqual(CandidateStore(root).read(date(2026, 11, 13)),
                             CandidateStore(restored).read(date(2026, 11, 13)))
            self.assertEqual(remote.writes, writes)
            with self.assertRaises(ValueError):
                restore(restored, receipt['checkpoint_sha256'], remote)

    def test_corrupt_restore_never_commits_destination(self):
        with tempfile.TemporaryDirectory() as temp:
            root, restored = Path(temp)/'candidate', Path(temp)/'restored'
            fixture(root)
            remote = Remote()
            receipt = save(root, remote)
            original = (root/'index.json').read_bytes()
            remote.fail_blob = True
            with self.assertRaises(ValueError):
                restore(restored, receipt['checkpoint_sha256'], remote)
            self.assertFalse(restored.exists())
            self.assertEqual((root/'index.json').read_bytes(), original)
            with self.assertRaises(ValueError):
                restore(restored, '../catalogue', remote)

    def test_public_bucket_and_corrupt_local_revision_refuse_writes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)/'candidate'
            fixture(root)
            remote = Remote()
            remote.public = True
            with self.assertRaises(ValueError):
                save(root, remote)
            self.assertEqual(remote.writes, 0)
            remote.public = False
            next((root/'blobs').glob('*')).write_bytes(b'corrupt')
            with self.assertRaises(ValueError):
                save(root, remote)
            self.assertEqual(remote.writes, 0)


if __name__ == '__main__':
    unittest.main()
