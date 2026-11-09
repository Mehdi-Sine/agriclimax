"""Policy guard: manual model GET only; paid jobs must never run on ephemeral CI."""
import unittest

import yaml

from scripts.quality.check_automation import ROOT, UniqueLoader


class ManualEditorialWorkflowTest(unittest.TestCase):
    def setUp(self):
        self.workflow = yaml.load(
            (ROOT / '.github/workflows/editorial-ai-manual.yml').read_text(), Loader=UniqueLoader
        )

    def test_dispatch_is_the_only_event(self):
        self.assertEqual(set(self.workflow['on']), {'workflow_dispatch'})
        self.assertEqual(self.workflow['permissions'], {'contents': 'read'})

    def test_owner_and_default_branch_are_required_for_verification(self):
        job = self.workflow['jobs']['verify-model']
        self.assertIn('github.actor == github.repository_owner', job['if'])
        self.assertIn('github.event.repository.default_branch', job['if'])
        self.assertIn("inputs.mode == 'verify-model'", job['if'])
        self.assertEqual(job['environment'], 'editorial-ai-dev')
        secret_steps = [s for s in job['steps'] if 'OPENAI_API_KEY' in s.get('env', {})]
        self.assertEqual(len(secret_steps), 1)
        self.assertIn('verify-model', secret_steps[0]['run'])
        self.assertNotIn('generate-once', secret_steps[0]['run'])

    def test_ephemeral_generation_has_no_secret_checkout_or_provider(self):
        job = self.workflow['jobs']['generate-once-disabled']
        self.assertEqual(job['if'], "inputs.mode == 'generate-once'")
        self.assertNotIn('env', job)
        self.assertEqual(len(job['steps']), 1)
        step = job['steps'][0]
        self.assertNotIn('env', step)
        self.assertNotIn('uses', step)
        self.assertIn('EPHEMERAL_CI_GENERATION_DISABLED', step['run'])
        self.assertIn('exit 78', step['run'])
