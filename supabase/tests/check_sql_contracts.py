"""Validate real SQL output against the frozen contracts (offline).

Usage: python supabase/tests/check_sql_contracts.py work/sql-contracts.json
"""
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

root = Path(__file__).resolve().parents[2]
output = json.loads(Path(sys.argv[1]).read_text())
validators = {
    name: Draft202012Validator(json.loads((root / f"contracts/jsonschema/{name}.schema.json").read_text()),
                                format_checker=FormatChecker())
    for name in ("risk-result", "map-feature")
}
for feature in output["map"]["features"]:
    validators["map-feature"].validate(feature["properties"])
    validators["risk-result"].validate(feature["properties"]["result"])
    assert feature["geometry"]["type"] == "Polygon"
    for ring in feature["geometry"]["coordinates"]:
        assert len(ring) >= 4 and ring[0] == ring[-1]
for result in output["series"]:
    validators["risk-result"].validate(result)
assert len(output["map"]["features"]) == 2 and output["map"]["truncated"]
assert len(output["series"]) == 10
assert sum(group["cell_count"] for group in output["territory"]["groups"]) == 250
print("Real SQL output: 2 map features, 10 V1 risk results, 250 intersecting cell-days validated.")
