"""Ordinary CI cannot receive real acquisition/persistence credentials."""

import unittest
from pathlib import Path

import yaml


class AcquisitionBoundaries(unittest.TestCase):
    def test_ci_workflows_have_no_live_source_or_database_credentials(self):
        for path in Path(".github/workflows").glob("*.yml"):
            text = path.read_text()
            document = yaml.load(text, Loader=yaml.BaseLoader)
            triggers = document.get("on", {})
            if any(
                event in triggers
                for event in ("pull_request", "pull_request_target", "push")
            ):
                for secret in (
                    "SUPABASE_SECRET_KEY",
                    "SUPABASE_SERVICE_ROLE_KEY",
                    "CDSAPI_KEY",
                    "METEOFRANCE_AROME_API_KEY",
                    "METEOFRANCE_ARPEGE_API_KEY",
                    "METEOFRANCE_OBSERVATIONS_API_KEY",
                    "METEOFRANCE_CLIMATOLOGY_API_KEY",
                ):
                    self.assertNotIn("secrets." + secret, text, str(path))

    def test_legacy_real_smoke_requires_explicit_dev_write_authorization(self):
        workflow = yaml.load(
            Path(".github/workflows/task12-era5-real-validation.yml").read_text(),
            Loader=yaml.BaseLoader,
        )
        self.assertEqual(set(workflow["on"]), {"workflow_dispatch"})
        self.assertEqual(
            workflow["on"]["workflow_dispatch"]["inputs"]["allow_dev_write"]["default"],
            "false",
        )
        self.assertIn("inputs.allow_dev_write", workflow["jobs"]["validate-era5"]["if"])

    def test_dispatch_inputs_stay_within_platform_limit(self):
        workflow = yaml.load(
            Path(".github/workflows/pra-climate.yml").read_text(),
            Loader=yaml.BaseLoader,
        )
        self.assertLessEqual(len(workflow["on"]["workflow_dispatch"]["inputs"]), 10)
