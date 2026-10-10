"""Offline validation of frozen V1 schemas, demo examples and YAML configuration."""
import json
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
STATUSES = ['exploratory', 'documented', 'expert_reviewed', 'validated', 'deprecated']


def validate_contract(name: str, payload: Any) -> None:
    schema = json.loads((ROOT / 'contracts/jsonschema' / f'{name}.schema.json').read_text())
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(payload)


def validate_config(root: Path = ROOT) -> int:
    schemas = {
        'productions': {
            'required': ['id', 'name_fr', 'category', 'scientific_status', 'sources'],
            'properties': {'id': {'type': 'string', 'minLength': 1},
                           'name_fr': {'type': 'string'},
                           'category': {'enum': ['crop', 'livestock']},
                           'scientific_status': {'enum': STATUSES},
                           'sources': {'type': 'array'}},
        },
        'indicators': {
            'required': ['schema_version', 'indicators'],
            'properties': {'schema_version': {'const': '1.0'}, 'indicators': {
                'type': 'array', 'minItems': 1, 'items': {
                    'type': 'object', 'required': ['id', 'name_fr', 'unit', 'scientific_status'],
                    'properties': {'id': {'type': 'string'}, 'name_fr': {'type': 'string'},
                                   'unit': {'type': 'string'},
                                   'scientific_status': {'enum': STATUSES}},
                }}},
        },
        'rules': {
            'required': ['rule_id', 'version', 'status', 'production_id', 'indicator_id',
                         'parameters', 'classification', 'sources'],
            'properties': {'rule_id': {'type': 'string'}, 'version': {'type': 'string'},
                           'status': {'enum': STATUSES}, 'production_id': {'type': 'string'},
                           'indicator_id': {'type': 'string'},
                           'parameters': {'type': 'object', 'additionalProperties': {'type': 'number'}},
                           'classification': {'type': 'object',
                                              'required': ['moderate', 'high', 'critical'],
                                              'additionalProperties': {'type': 'number'}},
                           'sources': {'type': 'array'}},
        },
    }
    documents: dict[str, list[dict[str, Any]]] = {}
    for category, schema in schemas.items():
        files = sorted((root / 'config' / category).glob('*.yaml'))
        if not files:
            raise ValueError(f'Missing configuration: {category}')
        documents[category] = []
        validator = Draft202012Validator({'type': 'object', **schema})
        for path in files:
            payload = yaml.safe_load(path.read_text())
            validator.validate(payload)
            documents[category].append(payload)
    productions = [p['id'] for p in documents['productions']]
    indicators = [i['id'] for d in documents['indicators'] for i in d['indicators']]
    rules = [r['rule_id'] for r in documents['rules']]
    for ids in (productions, indicators, rules):
        if len(ids) != len(set(ids)):
            raise ValueError('Duplicate configuration identifiers')
    for rule in documents['rules']:
        if rule['production_id'] not in productions or rule['indicator_id'] not in indicators:
            raise ValueError('Unknown rule production/indicator reference')
    return sum(map(len, documents.values()))


def check_all() -> None:
    for name in ('risk-result', 'map-feature', 'watch-signal'):
        payload = json.loads((ROOT / 'fixtures/contracts' / f'{name}.json').read_text())
        validate_contract(name, payload)
    collection = json.loads((ROOT / 'fixtures/demo-risk.geojson').read_text())
    if collection != json.loads((ROOT / 'fixtures/demo-risk.geojson.json').read_text()):
        raise ValueError('Web fixture differs from canonical GeoJSON')
    if collection.get('agriclimax_demo') is not True or not collection['features']:
        raise ValueError('Demo collection must be explicitly fictitious and nonempty')
    for feature in collection['features']:
        validate_contract('map-feature', feature['properties'])
        if feature['properties'].get('demo') is not True:
            raise ValueError('Missing demo marker')
    count = validate_config()
    print(f'V1: 3 schemas/examples, demo GeoJSON and {count} YAML files validated offline.')


if __name__ == '__main__':
    check_all()
