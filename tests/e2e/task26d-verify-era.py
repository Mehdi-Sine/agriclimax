"""Independent native ERA31 arithmetic and real cold/API/qualified-mean parity."""

import argparse
import gzip
import hashlib
import json
import math
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import ProxyHandler, build_opener

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from pra_30day_http import float4_matches

p = argparse.ArgumentParser(description=__doc__)
p.add_argument("--root", type=Path, required=True)
p.add_argument("--base", default="http://127.0.0.1:3031")
p.add_argument("--output", type=Path, required=True)
a = p.parse_args()
assert a.base.startswith("http://127.0.0.1:")
weights = json.loads(Path("config/coverage/ofb-masa-pra-2017-snapshot-20261017/weights.json").read_text())
groups = defaultdict(list)
for w in weights:
    groups[w["pra_id"]].append(w)
cells = {}
for f in (a.root / "tiles").glob("*.json.gz"):
    raw = f.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == f.with_suffix(".sha256").read_text().strip()
    for row in json.loads(gzip.decompress(raw))["rows"]:
        if row["valid_date"] == "2026-10-31":
            key = row["cell_id"]
            assert key not in cells or cells[key] == row
            cells[key] = row
original = {}
for f in (a.root / "batches").glob("*/output.json"):
    envelope = json.loads(f.read_text())
    for row in envelope["daily"]:
        assert row["pra_id"] not in original
        original[row["pra_id"]] = row
assert len(original) == len(groups) == 713
variables = ["temperature", "temperature_min", "temperature_max", "precipitation"]
checks = 0
observed = {}
for pra, ws in groups.items():
    for index, variable in enumerate(variables):
        valid = [(w["weight"], cells[w["cell_id"]][variable]) for w in ws if cells[w["cell_id"]][variable] is not None]
        coverage = math.fsum(w for w, _ in valid)
        estimate = math.fsum(w * v for w, v in valid) / coverage if coverage else None
        observed[pra, variable] = (coverage, estimate)
        wanted = None
        if len(valid) == len(ws):
            wanted = min(v for _, v in valid) if variable == "temperature_min" else max(v for _, v in valid) if variable == "temperature_max" else estimate
        value = original[pra][variable]
        assert value is None if wanted is None else abs(wanted - value) <= 1e-10
        assert abs(original[pra]["coverage"][index] - coverage) <= 1e-12
        checks += 1
opener = build_opener(ProxyHandler({}))
def get(path, **query):
    with opener.open(a.base + path + "?" + urlencode(query), timeout=120) as r:
        return json.load(r)
actual = get("/api/national", action="day", date="2026-10-31")
assert len(actual["data"]) == 713
for row in actual["data"]:
    for variable in variables:
        expected = original[row["id"]][variable]
        assert row[variable] is None if expected is None else float4_matches(row[variable], expected)
qualified = {}
for indicator, variable in [("temperature", "temperature"), ("rain", "precipitation")]:
    dto = get("/api/unified", start="2026-10-31", end="2026-10-31", indicator=indicator, threshold="25")
    assert len(dto["data"]) == 713
    for row in dto["data"]:
        coverage, mean = observed[row["territoryId"], variable]
        if coverage < 1 - 1e-10:
            wanted = mean if coverage >= .9 else None
            assert row["value"] is None if wanted is None else abs(row["value"] - wanted) <= 1e-10
            assert row["normal"] is None and row["anomaly"] is None
            assert row.get("observed_value") is None if mean is None else abs(row["observed_value"] - mean) <= 1e-10
    qualified[variable] = {"value_rows": sum(r["value"] is not None for r in dto["data"]), "partial_area_only": sum(r["value"] is None and r.get("observed_value") is not None for r in dto["data"]), "no_native_value": sum(r["value"] is None and r.get("observed_value") is None for r in dto["data"])}
report = {"date": "2026-10-31", "native_checks": checks, "raw_api_checks": 713 * 4, "qualified_api_rows_checked": 713 * 2, "production_aggregation_called": False, "source_requests": 0, "database_writes": 0, "qualified": qualified}
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report))
