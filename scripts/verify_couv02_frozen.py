"""Independent stdlib verification of COUV-02 results and unchanged source evidence.

Does not import the adapter, geospatial calculator, or production archive decoder.
Checks every selected PRA/day/variable against its actual archived input value.
"""

from __future__ import annotations

import csv
import gzip
import hashlib
import io
import json
import math
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path("docs/codex/COUV-02/evidence")


def main() -> None:
    inputs = json.loads((ROOT / "input-checksums.json").read_bytes())
    outputs = json.loads((ROOT / "MANIFEST.json").read_bytes())
    for path, digest in inputs.items():
        assert hashlib.sha256(Path(path).read_bytes()).hexdigest() == digest, path
    for path, digest in outputs.items():
        assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest, path
    restored_path = Path("apps/web/data/operational/era5-restored-support.json")
    restored = json.loads(restored_path.read_bytes())
    partial = {(r["pra_id"], day, field): r for day, variables in restored["days"].items()
               for field, rows in variables.items() for r in rows}
    legacy = {}
    for p in Path("docs/codex/DATA-01/evidence/legacy").glob("????-??-??.json.gz"):
        doc = json.loads(gzip.decompress(p.read_bytes()))
        legacy.update({(r["id"], doc["date"]): r for r in doc["rows"]})
    sim_root = Path("docs/codex/COUV-01/evidence")
    sim_summary = json.loads((sim_root / "summary.json").read_bytes())
    snapshot = sim_root / "snapshots" / sim_summary["source_sha256"]
    sim = {}
    for p in snapshot.glob("????-??-??.json.gz"):
        packed = json.loads(gzip.decompress(p.read_bytes()))
        columns = {k: c["values"] if "values" in c else [c["dictionary"][i] for i in c["codes"]]
                   for k,c in packed["columns"].items()}
        for i in range(packed["count"]):
            r = {k: v[i] for k,v in columns.items()}
            sim[r["pra_id"], r["date"], r["variable"]] = r
    with gzip.open(ROOT / "selected-daily-matrix.csv.gz", "rt") as stream:
        rows = list(csv.DictReader(stream))
    seen = set()
    series = defaultdict(list)
    source_counts = Counter()
    for r in rows:
        key = r["pra_id"], r["date"], r["variable"]
        assert key not in seen
        seen.add(key)
        fraction = float(r["fraction"])
        assert .9 <= fraction <= 1.0001
        value = r["value"] or r["observed_value"]
        assert value and math.isfinite(float(value))
        if fraction < .9999:
            assert r["value"] == "" and r["observed_value"] != ""
            assert r["state"] == "observed_partial"
        else:
            assert r["state"] == "native_complete"
        if r["source"] == "meteo-france-sim":
            native = sim[key]
            expected = native["value"] if native["value"] is not None else native["partial_value"]
            assert fraction == native["spatial_coverage"]
            assert r["period"] == native["period"]
            assert r["provenance"] == native["provenance"]
            assert r["nature"] == "analysis"
        else:
            field = "temperature" if r["variable"] == "temperature_mean" else "precipitation"
            l = legacy[r["pra_id"], r["date"]]
            expected = l[field]
            if expected is None:
                native = partial[r["pra_id"], r["date"], field]
                expected = native["observed_value"]
                assert fraction == native["coverage"]
                assert inputs[str(restored_path)] in r["provenance"]
            assert r["nature"] == "reanalysis"
            assert r["period"] == ("00UTC-24UTC_hourly" if field == "temperature"
                                   else "next_day_00UTC_accumulation")
        assert float(value) == expected, key
        series[r["pra_id"], r["variable"]].append(r)
        source_counts[r["source"]] += 1
    expected_dates = {str(date(2026, 10, 2)+timedelta(days=i)) for i in range(29)}
    assert len(rows) == 713*29*2 and len(series) == 713*2
    for values in series.values():
        assert {r["date"] for r in values} == expected_dates
        assert len({(r["source"], r["period"], r["support_id"]) for r in values}) == 1
    residual = list(csv.DictReader(io.StringIO((ROOT / "residual-38.csv").read_text())))
    assert len(residual) == 38 and all(float(r["sim_percent"]) >= 90 for r in residual)
    national = list(csv.DictReader(io.StringIO((ROOT / "national-713.csv").read_text())))
    assert len(national) == 713 and sum(r["source"] == "meteo-france-sim" for r in national) == 32
    assert sum(r["era_category"] != "unavailable" for r in national) == 681
    assert sum(r["selected_category"] != "unavailable" for r in national) == 713
    print(json.dumps({"status": "passed", "exact_selected_values_checked": len(rows),
                      "homogeneous_series": len(series), "residual_pra": len(residual),
                      "source_row_counts": dict(source_counts), "input_checksums": len(inputs)}))


if __name__ == "__main__":
    main()
