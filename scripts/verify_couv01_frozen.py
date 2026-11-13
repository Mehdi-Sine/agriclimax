"""Offline reference using stdlib only; no production calculator or archive decoder.

Dynamic JSON/CSV structures are confined to this independent evidence program.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import math
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root", type=Path, default=Path("docs/codex/COUV-01/evidence")
    )
    args = parser.parse_args()
    root = args.root
    summary = json.loads((root / "summary.json").read_bytes())
    snapshot = root / "snapshots" / summary["source_sha256"]
    manifest = json.loads((snapshot / "manifest.json").read_bytes())
    assert len(manifest["days"]) == 60
    first = date.fromisoformat(manifest["days"][0]["date"])
    assert [e["date"] for e in manifest["days"]] == [
        str(first + timedelta(days=i)) for i in range(60)
    ]
    weights_raw = gzip.decompress((root / "weights.json.gz").read_bytes())
    assert hashlib.sha256(weights_raw).hexdigest() == manifest["support_sha256"]
    support = json.loads(weights_raw)
    coordinate_raw = gzip.decompress(
        (
            root / "source" / "coordonnees_grille_safran_lambert-2-etendu.csv.gz"
        ).read_bytes()
    )
    assert hashlib.sha256(coordinate_raw).hexdigest() == support["grid_sha256"]
    weights = defaultdict(list)
    for w in support["records"]:
        weights[w["pra_id"]].append(w)
    assert len(weights) == 713
    lookups = {}
    state_counts = Counter()
    for entry in manifest["days"]:
        raw = (snapshot / (entry["date"] + ".json.gz")).read_bytes()
        assert (
            len(raw) == entry["bytes"]
            and hashlib.sha256(raw).hexdigest() == entry["sha256"]
        )
        packed = json.loads(gzip.decompress(raw))
        assert packed["archive_version"] == "pra-weather-columnar-1"
        assert packed["count"] == 3565
        columns = {
            key: col.get("values")
            if "values" in col
            else [col["dictionary"][c] for c in col["codes"]]
            for key, col in packed["columns"].items()
        }
        assert all(len(c) == packed["count"] for c in columns.values())
        day = {}
        for i in range(packed["count"]):
            row = {key: values[i] for key, values in columns.items()}
            assert (
                row["date"] == entry["date"]
                and row["provenance"] == summary["source_sha256"]
            )
            assert row["scientific_validation"] == "technical_checks_only"
            assert (row["pra_id"], row["variable"]) not in day
            day[row["pra_id"], row["variable"]] = row
            state_counts[row["state"]] += 1
        assert len(day) == 3565 and {pra for pra, _ in day} == set(weights)
        lookups[entry["date"]] = day
    native = list(
        csv.DictReader(
            io.StringIO(
                gzip.decompress(
                    (root / "sample-native-rows.csv.gz").read_bytes()
                ).decode()
            )
        )
    )
    native = {(r["cell_id"], r["date"]): r for r in native}
    fields = {
        "temperature_mean": ["T"],
        "precipitation": ["PRELIQ", "PRENEI"],
        "relative_humidity_mean": ["HU"],
        "hourly_temperature_min_mean": ["TINF_H"],
        "hourly_temperature_max_mean": ["TSUP_H"],
    }
    samples = json.loads((root / "samples.json").read_bytes())
    for sample in samples:
        pra, day, variable = sample["pra_id"], sample["date"], sample["variable"]
        w = weights[pra]
        total = math.fsum(x["weight"] for x in w)
        expected = (
            math.fsum(
                x["weight"]
                * sum(float(native[x["cell_id"], day][f]) for f in fields[variable])
                for x in w
            )
            / total
        )
        row = lookups[day][pra, variable]
        actual = row["value"] if row["value"] is not None else row["partial_value"]
        assert abs(expected - actual) < 1e-10
        assert (row["value"] is not None) == (total >= 0.9999)
    window_counts = {}
    for length in [7, 14, 30]:
        last = date.fromisoformat(manifest["days"][-1]["date"])
        days = [str(last - timedelta(days=i)) for i in range(length)]
        counts = Counter()
        for pra, var in lookups[days[0]]:
            series = [lookups[d][pra, var] for d in days]
            if (
                all(
                    r["state"] == "native_complete"
                    and r["value"] is not None
                    and r["temporal_coverage"] == 1
                    for r in series
                )
                and len({r["support_id"] for r in series}) == 1
            ):
                counts[var] += 1
        assert all(v == 675 for v in counts.values()) and len(counts) == 5
        window_counts[length] = dict(counts)
    legacy = root / "legacy"
    old = json.loads((legacy / "manifest.json").read_bytes())
    assert len(old["dates"]) == 30 and old["missing_dates"] == []
    eligible = set(weights)
    for entry in old["dates"]:
        raw = (legacy / (entry["date"] + ".json.gz")).read_bytes()
        assert (
            len(raw) == entry["bytes"]
            and hashlib.sha256(raw).hexdigest() == entry["sha256"]
        )
        doc = json.loads(gzip.decompress(raw))
        rows = doc["rows"]
        assert len(rows) == 713 and {r["id"] for r in rows} == set(weights)
        eligible &= {
            r["id"]
            for r in rows
            if r["status"] == "available"
            and min(r["coverage"]) >= 0.9999
            and all(
                r[v] is not None
                for v in [
                    "temperature",
                    "temperature_min",
                    "temperature_max",
                    "precipitation",
                ]
            )
        }
    assert len(eligible) == 645
    station_doc = json.loads((root / "station-comparison.json").read_bytes())
    station_native_rows = list(
        csv.DictReader(
            io.StringIO(
                gzip.decompress(
                    (root / "selected-station-rows.csv.gz").read_bytes()
                ).decode()
            )
        )
    )
    station_native = {(r["pra_id"], r["AAAAMMJJ"]): r for r in station_native_rows}
    station_pairs = 0
    for diagnostic in station_doc["results"]:
        if "pairs" not in diagnostic:
            continue
        differences = []
        field = "TM" if diagnostic["variable"] == "temperature_mean" else "RR"
        for pair in diagnostic["pairs"]:
            native = station_native[diagnostic["pra_id"], pair["date"].replace("-", "")]
            assert native["NUM_POSTE"] == diagnostic["station_id"]
            assert native["Q" + field] in {"0", "1"}
            row = lookups[pair["date"]][diagnostic["pra_id"], diagnostic["variable"]]
            value = row["value"] if row["value"] is not None else row["partial_value"]
            expected = value - float(native[field])
            assert abs(expected - pair["difference"]) < 1e-10
            differences.append(expected)
            station_pairs += 1
        assert (
            abs(math.fsum(differences) / len(differences) - diagnostic["bias"]) < 1e-10
        )
        assert (
            abs(
                math.fsum(abs(d) for d in differences) / len(differences)
                - diagnostic["mae"]
            )
            < 1e-10
        )
    assert station_pairs == 84
    print(
        json.dumps(
            {
                "status": "passed",
                "station_point_pairs": station_pairs,
                "daily_archives": 60,
                "pra_variable_days": sum(state_counts.values()),
                "states": dict(state_counts),
                "sample_comparisons": len(samples),
                "window_counts": window_counts,
                "legacy_dates": 30,
                "legacy_complete_30_day_pra": len(eligible),
            }
        )
    )


if __name__ == "__main__":
    main()
