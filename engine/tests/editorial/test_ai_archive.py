"""Cross-runtime validation of the offline T35 examples; never calls a provider."""
import json
from pathlib import Path

import pytest
from referencing import Registry, Resource
from jsonschema import Draft7Validator, FormatChecker, ValidationError

ROOT = Path(__file__).resolve().parents[3]


@pytest.mark.parametrize("name", ["simulated-edition", "forecast-edition"])
def test_ai_archive_contract(name: str) -> None:
    schema = json.loads((ROOT / "contracts/jsonschema/editorial-archive-1.schema.json").read_text())
    Draft7Validator.check_schema(schema)
    archive = json.loads((ROOT / f"docs/codex/task35/evidence/{name}.json").read_text())
    briefing = json.loads((ROOT / "contracts/jsonschema/editorial-briefing-1.schema.json").read_text())
    registry = Registry().with_resource(briefing["$id"], Resource.from_contents(briefing))
    validator = Draft7Validator(schema, registry=registry, format_checker=FormatChecker())
    validator.validate(archive)
    assert archive["mode"] == "simulation"
    assert archive["receipt"] is None
    assert archive["status"] == "needs_editorial_review"
    archive["draft"]["unapproved_field"] = "not allowed"
    with pytest.raises(ValidationError):
        validator.validate(archive)
