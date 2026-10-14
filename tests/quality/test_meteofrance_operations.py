"""Exercise delivered workflow shell steps without contacting APIs or a database."""

import os
import subprocess
import tempfile
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / '.github/workflows/meteofrance-ingestion.yml'
REQUIRED = (
    'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_KEY',
    'METEOFRANCE_CLIMATOLOGY_API_KEY', 'METEOFRANCE_OBSERVATIONS_API_KEY',
)


class MeteoFranceOperations(unittest.TestCase):
    def step(self, name):
        workflow = yaml.safe_load(WORKFLOW.read_text())
        return next(step['run'] for step in workflow['jobs']['live']['steps']
                    if step.get('name', '').startswith(name))

    def test_preflight_reports_names_without_values_and_keeps_log(self):
        for present in (False, True):
            with self.subTest(present=present), tempfile.TemporaryDirectory() as directory:
                environment = os.environ.copy()
                for name in REQUIRED:
                    environment.pop(name, None)
                    if present:
                        environment[name] = 'synthetic-ops-binding'
                result = subprocess.run(['bash', '-c', self.step('Verify runtime')],
                                        cwd=directory, env=environment,
                                        capture_output=True, text=True, check=False)
                self.assertEqual(result.returncode, 0 if present else 1)
                self.assertNotIn('synthetic-ops-binding', result.stdout + result.stderr)
                self.assertTrue(Path(directory, 'work/meteofrance/logs/configuration.log').exists())
                if not present:
                    for name in REQUIRED:
                        self.assertIn(name, result.stdout)

    def test_tee_preserves_cli_failure_and_manual_range_arguments(self):
        for status, explicit_dates in ((0, False), (7, False), (0, True)):
            with self.subTest(status=status, explicit=explicit_dates), tempfile.TemporaryDirectory() as directory:
                fake_bin = Path(directory, 'bin')
                fake_bin.mkdir()
                executable = fake_bin / 'python'
                executable.write_text('#!/bin/sh\nprintf "%s\\n" "$@"\nexit ' + str(status) + '\n')
                executable.chmod(0o755)
                log = Path(directory, 'work/meteofrance/logs/archive.log')
                log.parent.mkdir(parents=True)
                environment = os.environ.copy()
                environment.update(PATH=str(fake_bin) + os.pathsep + environment['PATH'],
                                   DATE_FROM='2026-09-01' if explicit_dates else '',
                                   DATE_TO='2026-09-30' if explicit_dates else '')
                result = subprocess.run(['bash', '-c', self.step('Qualified daily')],
                                        cwd=directory, env=environment,
                                        capture_output=True, text=True, check=False)
                self.assertEqual(result.returncode, status)
                output = log.read_text()
                self.assertIn('--from\n2026-09-01\n--to\n2026-09-30' if explicit_dates
                              else '--daily', output)


if __name__ == '__main__':
    unittest.main()
