"""Rolling candidate storage has fixed remote growth and survives interrupted saves."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from agriclimax.climate.safran_incremental import sha
from couv04_checkpoint import MAX_SLOT, POINTER, PREFIX, SLOTS, restore, save
from pra_weather_store import BUCKET
from test_couv03b_checkpoint import fixture


class Remote:
    def __init__(self):
        self.objects = {}
        self.writes = 0
        self.fail_pointer = False

    def request(self, path, method='GET', body=None, upsert=False):
        if path == 'bucket':
            return json.dumps([{'id': BUCKET, 'public': False}]).encode()
        key = path.removeprefix(f'object/{BUCKET}/')
        assert key.startswith(PREFIX + '/')
        if method == 'GET':
            return self.objects.get(key, b'')
        assert method == 'POST' and upsert
        if key == POINTER and self.fail_pointer:
            raise OSError('interrupted before pointer')
        self.objects[key] = body
        self.writes += 1
        return b'{}'

    def blob(self, path, checksum):
        raw = self.request(f'object/{BUCKET}/{path}')
        if sha(raw) != checksum:
            raise ValueError('checksum')
        return raw


class RollingTests(unittest.TestCase):
    def test_roundtrip_corruption_idempotence_and_bounded_growth(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / 'candidate'
            fixture(root)
            remote = Remote()
            self.assertEqual(restore(Path(temp)/'empty', remote)['status'], 'empty')
            self.assertFalse((Path(temp)/'empty').exists())
            for i in range(12):
                report = json.loads((root/'report.json').read_bytes())
                report['test_revision'] = i
                (root/'report.json').write_text(json.dumps(report))
                receipt = save(root, remote)
                self.assertEqual(receipt['generation'], i)
            self.assertEqual(len(remote.objects), SLOTS + 1)
            writes = remote.writes
            self.assertEqual(save(root, remote)['status'], 'unchanged')
            self.assertEqual(remote.writes, writes)
            restored = Path(temp)/'restored'
            restore(restored, remote)
            self.assertEqual((root/'index.json').read_bytes(), (restored/'index.json').read_bytes())
            self.assertEqual(json.loads((restored/'report.json').read_bytes())['test_revision'], 11)
            key = f"{PREFIX}/slot-{receipt['slot']}.json.gz"
            remote.objects[key] = b'corrupt'
            with self.assertRaises(ValueError):
                restore(Path(temp)/'corrupt', remote)
            self.assertFalse((Path(temp)/'corrupt').exists())

    def test_failed_save_preserves_previous_pointer_and_restore(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)/'candidate'
            fixture(root)
            remote = Remote()
            first = save(root, remote)
            original = remote.objects[POINTER]
            (root/'report.json').write_text(json.dumps({'pra_count':32,
                'indicator_eligible':False, 'journal_eligible':False, 'new':True}))
            with patch('couv04_checkpoint.MAX_SLOT', 1), self.assertRaises(ValueError):
                save(root, remote)
            self.assertEqual(remote.objects[POINTER], original)
            remote.fail_pointer = True
            with self.assertRaises(OSError):
                save(root, remote)
            self.assertEqual(remote.objects[POINTER], original)
            self.assertEqual(restore(Path(temp)/'recovered', remote)['sha256'], first['sha256'])
            self.assertLessEqual(sum(map(len, remote.objects.values())), SLOTS * MAX_SLOT + 4096)


if __name__ == '__main__':
    unittest.main()
