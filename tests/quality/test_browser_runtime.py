"""Prevent an independent Playwright dependency bump from breaking the CI image."""
import json
import re
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]


class BrowserRuntime(unittest.TestCase):
    def test_official_image_is_immutable_and_matches_both_locked_packages(self):
        workflow = yaml.safe_load((ROOT / '.github/workflows/quality.yml').read_text())
        job = workflow['jobs']['web-demo']
        manifest = json.loads((ROOT / 'tests/e2e/package.json').read_text())
        lock = json.loads((ROOT / 'tests/e2e/package-lock.json').read_text())
        version = manifest['dependencies']['playwright']
        self.assertRegex(version, r'^\d+\.\d+\.\d+$')
        for name in ('playwright', 'playwright-core'):
            self.assertEqual(lock['packages'][f'node_modules/{name}']['version'], version)
        self.assertRegex(job['container']['image'],
                         rf'^mcr\.microsoft\.com/playwright:v{re.escape(version)}-noble@sha256:[a-f0-9]{{64}}$')
        self.assertEqual(job['env']['PLAYWRIGHT_BROWSERS_PATH'], '/ms-playwright')
        self.assertEqual(job['defaults']['run']['shell'], 'bash')

    def test_browser_checks_remain_blocking_without_system_installation(self):
        job = yaml.safe_load((ROOT / '.github/workflows/quality.yml').read_text())['jobs']['web-demo']
        self.assertNotIn('continue-on-error', job)
        commands = '\n'.join(step.get('run', '') for step in job['steps'])
        self.assertNotRegex(commands, r'--with-deps|install-deps|\bapt(?:-get)?\b|playwright/cli\.js install')
        runtime = next(step for step in job['steps'] if step.get('run') == 'node scripts/quality/playwright-runtime.mjs')
        suite = next(step for step in job['steps'] if step.get('name') == 'Production demo smoke and browser checks')
        for step in (runtime, suite):
            self.assertNotIn('if', step)
            self.assertNotIn('continue-on-error', step)
        for script in ('task24', 'task35', 'demo', 'territories', 'integration', 'wheat', 'daily-risk', 'live-risk'):
            self.assertIn(f'node tests/e2e/{script}.mjs', suite['run'])
        self.assertIn('python scripts/quality/smoke.py', suite['run'])


if __name__ == '__main__':
    unittest.main()
