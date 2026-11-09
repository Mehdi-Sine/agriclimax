import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('nightly', Path('scripts/task36_nightly.py'))
nightly = importlib.util.module_from_spec(spec)
spec.loader.exec_module(nightly)

class RetryTests(unittest.TestCase):
    def test_supplier_classes(self):
        for code, state in [(429,'retryable_failure'),(500,'retryable_failure'),(401,'permanent_failure'),(403,'permanent_failure'),(404,'no_new_data'),(None,'retryable_failure')]:
            with self.subTest(code=code):
                self.assertEqual(nightly.failure(code)[0], state)
    def test_retry_after(self):
        self.assertEqual(nightly.failure(429,'3600'),('retryable_failure',3600))
        self.assertEqual(nightly.failure(429,'30')[1],1800)
    def test_no_openai_in_acquisition(self):
        for source in ['forecast','era5','stations','news']:
            self.assertNotIn('openai',str(nightly.commands(source)).lower())


class StationCooldownTests(unittest.TestCase):
    def test_long_supplier_cooldown_does_not_trigger_immediate_retries(self):
        import os
        from email.message import Message
        from unittest.mock import Mock, patch
        from urllib.error import HTTPError

        from agriclimax.ingestion.meteofrance import (
            MeteoFranceClient,
            MeteoFranceTransportError,
        )
        headers = Message()
        headers['Retry-After'] = '3600'
        opener = Mock(side_effect=HTTPError('https://synthetic.invalid', 429, 'limited', headers, None))
        wait = Mock()
        with patch.dict(os.environ, {'METEOFRANCE_CLIMATOLOGY_API_KEY': 'synthetic-test-only'}):
            client = MeteoFranceClient('climatology', opener=opener, sleep=wait)
            with self.assertRaises(MeteoFranceTransportError) as caught:
                client.get('synthetic')
        self.assertEqual(opener.call_count, 1)
        self.assertEqual(caught.exception.http_status, 429)
        self.assertEqual(caught.exception.retry_after, '3600')
        self.assertFalse(any(c.args[0] > 0 for c in wait.call_args_list))

if __name__ == "__main__":
    unittest.main()
