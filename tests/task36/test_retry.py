import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('nightly', Path('scripts/task36_nightly.py'))
nightly = importlib.util.module_from_spec(spec)
spec.loader.exec_module(nightly)

class RetryTests(unittest.TestCase):
    def test_supplier_classes(self):
        for code, state in [(429,'retryable_failure'),(500,'retryable_failure'),(401,'permanent_failure'),(403,'permanent_failure'),(404,'retryable_failure'),(204,'no_new_data'),(None,'retryable_failure')]:
            with self.subTest(code=code):
                self.assertEqual(nightly.failure(code)[0], state)
    def test_retry_after(self):
        self.assertEqual(nightly.failure(429,'3600'),('retryable_failure',3600))
        self.assertEqual(nightly.failure(429,'30')[1],1800)
    def test_no_openai_in_acquisition(self):
        for source in ['forecast','era5','stations','observations','news']:
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

class SourceReceiptTests(unittest.TestCase):
    def test_safe_receipt_keeps_auth_status_and_omits_exception_text(self):
        import json
        import tempfile

        from agriclimax.ingestion.meteofrance import MeteoFranceAccessError
        spec = importlib.util.spec_from_file_location('ingest_weather36', Path('scripts/ingest_weather.py'))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as root:
            module.record_source_failure(Path(root), MeteoFranceAccessError('synthetic-private-value'))
            raw = (Path(root) / 'source-failure.json').read_text()
            self.assertNotIn('synthetic-private-value', raw)
            self.assertTrue(json.loads(raw)['permanent_auth_failure'])

if __name__ == "__main__":
    unittest.main()

class AcquisitionLedgerTests(unittest.TestCase):
    def test_denial_records_explicit_noop_without_running_adapter(self):
        from unittest.mock import patch
        calls = []
        def fake_rpc(action, payload=None):
            calls.append((action, payload))
            return {'status': 'no_op', 'reason': 'already_completed'} if action == 'claim' else {'saved': True}
        with patch.object(nightly, 'rpc', side_effect=fake_rpc), patch.object(nightly.subprocess, 'run') as adapter:
            result = nightly.acquire('forecast', '2026-11-10')
        self.assertEqual(result['reason'], 'already_completed')
        adapter.assert_not_called()
        self.assertEqual(calls[-1][0], 'diagnostic')

    def test_adapter_receipt_classification_and_finish_are_persistent(self):
        import os
        import tempfile
        from unittest.mock import Mock, patch
        for receipt, expected in [({'status': 'no_new_data'}, 'no_new_data'),
                ({'http_status': 429, 'retry_after': '3600'}, 'retryable_failure'),
                ({'http_status': 401}, 'permanent_failure'),
                ({'http_status': 403}, 'permanent_failure'),
                ({'status': 'verified'}, 'success')]:
            with self.subTest(expected=expected), tempfile.TemporaryDirectory() as root:
                calls = []
                def fake_rpc(action, payload=None):
                    calls.append((action, payload))
                    return {'token': 'synthetic-lease'} if action == 'claim' else {'saved': True}
                def adapter(*args, **kwargs):
                    target = Path('work/era5-archive/report.json')
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_text(__import__('json').dumps(receipt))
                    return Mock(returncode=0)
                previous = os.getcwd()
                try:
                    os.chdir(root)
                    with patch.object(nightly, 'rpc', side_effect=fake_rpc), patch.object(nightly, 'commands', return_value=[['synthetic']]), patch.object(nightly.subprocess, 'run', side_effect=adapter):
                        result = nightly.acquire('era5', '2026-11-10')
                    self.assertEqual(result['state'], expected)
                    finish = next(payload for action, payload in calls if action == 'finish')
                    self.assertEqual(finish['state'], expected)
                    self.assertIn('finished_at', finish['checkpoint'])
                    if receipt.get('http_status') == 429:
                        self.assertEqual(finish['retry_after_seconds'], 3600)
                finally:
                    os.chdir(previous)

class StationDailyWindowTests(unittest.TestCase):
    def test_november_13_window_ends_two_days_before_edition(self):
        command = nightly.commands('stations', '2026-11-13')[0]
        self.assertEqual(command[command.index('--from') + 1], '2026-11-05')
        self.assertEqual(command[command.index('--to') + 1], '2026-11-11')
        self.assertNotIn('observations', command)

    def test_missing_daily_source_is_no_new_data_not_a_transport_retry(self):
        import json
        import os
        import tempfile
        from unittest.mock import Mock, patch
        with tempfile.TemporaryDirectory() as root:
            previous = os.getcwd()
            calls = []
            def fake_rpc(action, payload=None):
                calls.append((action, payload))
                return {'token': 'synthetic-lease'} if action == 'claim' else {'saved': True}
            def adapter(*args, **kwargs):
                target = Path('work/daily/logs/run.json')
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(json.dumps({'status': 'daily_source_unavailable',
                    'reason': 'DAILY_NO_COMPLETE_STATION_WINDOW', 'received_rows': 210, 'accepted_stations': []}))
                return Mock(returncode=1)
            try:
                os.chdir(root)
                with patch.object(nightly, 'rpc', side_effect=fake_rpc), patch.object(nightly, 'commands', return_value=[['synthetic']]), patch.object(nightly.subprocess, 'run', side_effect=adapter):
                    result = nightly.acquire('stations', '2026-11-13')
                self.assertEqual(result['state'], 'no_new_data')
                finish = next(payload for action, payload in calls if action == 'finish')
                self.assertEqual(finish['checkpoint']['report']['accepted_stations'], [])
            finally:
                os.chdir(previous)

class StationStandaloneDefaultsTests(unittest.TestCase):
    def test_standalone_cli_uses_the_same_conservative_window(self):
        import sys
        from datetime import UTC, datetime
        from unittest.mock import Mock, patch
        spec = importlib.util.spec_from_file_location('daily_cli_ops07', Path('scripts/daily_live.py'))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        now = datetime(2026, 11, 13, 4, tzinfo=UTC)
        with patch.object(sys, 'argv', ['daily_live.py']), patch.object(module, 'datetime') as clock, \
                patch.object(module, 'WheatRepository'), patch.object(module, 'live_provider', return_value=Mock()) as provider, \
                patch.object(module, 'run_daily', return_value=True) as run:
            clock.now.return_value = now
            self.assertEqual(module.main(), 0)
        self.assertEqual(str(provider.call_args.args[1]), '2026-11-05')
        self.assertEqual(str(provider.call_args.args[2]), '2026-11-11')
        self.assertEqual(str(run.call_args.kwargs['end']), '2026-11-11')
