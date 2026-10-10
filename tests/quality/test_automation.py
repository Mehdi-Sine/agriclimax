import copy
import importlib.util
import unittest
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator, ValidationError

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('automation', ROOT / 'scripts/quality/check_automation.py')
automation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(automation)


class Automation(unittest.TestCase):
    def test_yaml_on_stays_a_string_and_duplicates_fail(self):
        self.assertIn('on', yaml.load('on:\n  pull_request:\n', Loader=automation.UniqueLoader))
        with self.assertRaises(ValueError):
            yaml.load('jobs:\n  job: first\n  job: second\n', Loader=automation.UniqueLoader)

    def test_quality_workflows_reject_write_permissions_and_invalid_steps(self):
        sample = yaml.load((ROOT / '.github/workflows/quality.yml').read_text(),
                           Loader=automation.UniqueLoader)
        validator = Draft202012Validator(automation.SCHEMA)
        validator.validate(sample)
        invalid = copy.deepcopy(sample)
        invalid['permissions']['contents'] = 'write'
        with self.assertRaises(ValidationError): validator.validate(invalid)
        invalid = copy.deepcopy(sample)
        invalid['jobs']['guards']['steps'] = [{'name': 'does nothing'}]
        with self.assertRaises(ValidationError): validator.validate(invalid)


if __name__ == '__main__':
    unittest.main()
