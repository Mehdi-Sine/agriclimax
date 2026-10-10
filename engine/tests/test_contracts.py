import importlib.util
import json
from pathlib import Path

import pytest
from jsonschema import ValidationError

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('check_contracts', ROOT / 'scripts/check_contracts.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


def test_all_frozen_contracts_and_config():
    checker.check_all()


@pytest.mark.parametrize('field,value', [
    ('valid_date', '2026-02-30'), ('schema_version', '2.0'),
    ('confidence', {'level': 'critical', 'scientific_status': 'exploratory'}),
    ('provenance', []), ('rule', {'rule_id': 'demo_heat_wheat'}),
])
def test_reject_invalid_risk_result(field, value):
    payload = json.loads((ROOT / 'fixtures/contracts/risk-result.json').read_text())
    payload[field] = value
    with pytest.raises(ValidationError):
        checker.validate_contract('risk-result', payload)


def test_reject_unknown_config_reference(tmp_path):
    import shutil
    import yaml
    shutil.copytree(ROOT / 'config', tmp_path / 'config')
    rule_path = tmp_path / 'config/rules/EXAMPLE_heat.yaml'
    rule = yaml.safe_load(rule_path.read_text())
    rule['indicator_id'] = 'unknown'
    rule_path.write_text(yaml.safe_dump(rule))
    with pytest.raises(ValueError, match='Unknown'):
        checker.validate_config(tmp_path)


def test_reject_invalid_scientific_status(tmp_path):
    import shutil
    import yaml
    shutil.copytree(ROOT / 'config', tmp_path / 'config')
    path = tmp_path / 'config/productions/wheat_soft.yaml'
    production = yaml.safe_load(path.read_text())
    production['scientific_status'] = 'approved'
    path.write_text(yaml.safe_dump(production))
    with pytest.raises(ValidationError):
        checker.validate_config(tmp_path)
