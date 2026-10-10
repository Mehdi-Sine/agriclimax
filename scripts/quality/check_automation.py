"""Validate repo JSON/YAML and fail duplicate YAML keys before CI execution."""
import json
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[2]


class UniqueLoader(yaml.SafeLoader):
    pass


# YAML 1.1 otherwise turns the Actions key `on` into the boolean True.
UniqueLoader.yaml_implicit_resolvers = {
    key: [(tag, regex) for tag, regex in resolvers if tag != 'tag:yaml.org,2002:bool']
    for key, resolvers in yaml.SafeLoader.yaml_implicit_resolvers.items()
}


def mapping(loader, node):
    result = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node)
        if key in result:
            raise ValueError(f'Duplicate YAML key: {key}')
        result[key] = loader.construct_object(value_node)
    return result


UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, mapping)
SCHEMA = {
    'type': 'object', 'required': ['name', 'on', 'permissions', 'jobs'],
    'properties': {
        'name': {'type': 'string'},
        'on': {'type': 'object'},
        'permissions': {'type': 'object', 'properties': {'contents': {'const': 'read'}},
                        'additionalProperties': False, 'required': ['contents']},
        'jobs': {'type': 'object', 'minProperties': 1, 'additionalProperties': {
            'type': 'object', 'required': ['runs-on', 'timeout-minutes', 'steps'],
            'properties': {
                'timeout-minutes': {'type': 'integer', 'minimum': 1, 'maximum': 30},
                'steps': {'type': 'array', 'minItems': 1, 'items': {
                    'type': 'object', 'oneOf': [{'required': ['run']}, {'required': ['uses']}],
                }},
            },
        }},
    },
}


def check() -> None:
    for path in (ROOT / '.github').rglob('*.yml'):
        payload = yaml.load(path.read_text(), Loader=UniqueLoader)
        if path.parent.name == 'workflows' and path.name in {'quality.yml', 'security.yml'}:
            # Convert timeout strings, preserving all other YAML scalar values.
            for job in payload.get('jobs', {}).values():
                if isinstance(job.get('timeout-minutes'), str):
                    job['timeout-minutes'] = int(job['timeout-minutes'])
            Draft202012Validator(SCHEMA).validate(payload)
            if 'pull_request_target' in payload['on']:
                raise ValueError(f'{path.name}: privileged PR trigger prohibited')
    for path in [ROOT / 'package.json', ROOT / 'apps/web/package.json']:
        json.loads(path.read_text())
    print('Automation YAML/JSON structure, duplicates and read-only permissions validated.')


if __name__ == '__main__':
    check()
