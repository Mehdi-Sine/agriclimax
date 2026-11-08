"""Independent arithmetic and missing-data checks over real frozen adapter inputs.

Does not import the production calculator, adapter or coverage decision engine.
Does not validate representativeness against independent stations.
"""
from __future__ import annotations

import gzip
import json
import math
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/codex/CORE-01/evidence"


def independent(rows: list[dict], rule: dict, period: list[str]) -> tuple[float | None, float | None]:
    expected = (date.fromisoformat(period[1]) - date.fromisoformat(period[0])).days + 1
    values: list[float] = []
    keys = set()
    fractions = []
    origins = set()
    for row in rows:
        support = row.get("climate_support") or {}
        keys.add(support.get("identity", support.get("id")))
        fractions.append(support.get("fraction", math.nan))
        origins.add((row["source"], row["run"], row["nature"]))
        v = row["values"].get(rule["variables"][0])
        if (not row["complete"] or not row["compatible"] or not support.get("temporal_complete")
                or v is None or not math.isfinite(v)):
            continue
        if rule["variables"][0].startswith("temperature") and not -100 <= v <= 60:
            continue
        if rule["variables"][0] == "precipitation" and v < 0:
            continue
        values.append(v)
    if (len(values) != expected or len({r["date"] for r in rows}) != expected
            or len(keys) != 1 or None in keys or len(origins) != 1
            or any(not math.isfinite(f) or abs(f - fractions[0]) >= 1e-7 for f in fractions)):
        return None, None
    operator, threshold = rule["operator"], rule["threshold"]
    if operator == "mean":
        result = math.fsum(values) / expected
    elif operator == "gdd":
        result = math.fsum(max(0, v - threshold) for v in values)
    elif operator == "sum":
        result = math.fsum(values)
    else:
        above = operator in {"above", "longestAbove"}
        flags = [(v > threshold if above else v < threshold) for v in values]
        if operator in {"above", "below"}:
            result = float(sum(flags))
        else:
            longest = run = 0
            for flag in flags:
                run = run + 1 if flag else 0
                longest = max(longest, run)
            result = float(longest)
    # No certificate is present in the real inputs: no ≥90% automatic estimate.
    if fractions[0] < .9999:
        return None, result
    return result, None


def main() -> None:
    frozen = json.loads(gzip.decompress((OUT / "frozen-inputs.json.gz").read_bytes()))
    rules = {r["id"]: r for r in frozen["rules"]}
    errors = []
    maximum_error = 0.0
    for case in frozen["cases"]:
        rows = frozen["inputs"][case["input_key"]].get(case["pra"], [])
        expected = independent(rows, rules[case["rule_id"]], case["period"])
        for kind, actual, reference in zip(("value", "observed_value"), (case["value"], case["observed_value"]), expected):
            if actual is None or reference is None:
                if actual is not reference:
                    errors.append([case["pra"], case["rule_id"], case["period"], kind, actual, reference])
            else:
                error = abs(actual - reference)
                maximum_error = max(maximum_error, error)
                if error > 1e-9:
                    errors.append([case["pra"], case["rule_id"], kind, error])
    matrix = json.loads(gzip.decompress((OUT / "matrix.json.gz").read_bytes()))
    single = [r for r in matrix if r["indicator"] == "temperature_mean" and r["nature"] == "reanalysis" and r["period"][0] == r["period"][1]]
    fractions = [r["spatial_coverage"] for r in single if r["state"] == "observed_partial"]
    sensitivity = {str(t): {"partial_candidates": sum(f >= t for f in fractions), "certified_estimates": 0} for t in (.8, .85, .9, .95, .99)}
    groups = Counter((r["nature"], tuple(r["period"]), r["indicator"]) for r in matrix)
    assert all(n == 713 for n in groups.values())
    assert len([r for r in single if r["region"] == "Corse"]) == 6
    report = {"cases": len(frozen["cases"]), "scalar_comparisons": len(frozen["cases"])*2,
              "mismatches": errors[:20], "maximum_absolute_error": maximum_error,
              "threshold_sensitivity": sensitivity,
              "limits": "Adapter-input arithmetic verification; no station calibration, no fresh reaggregation of raw ERA cells."}
    (OUT / "independent.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    raise SystemExit(1 if errors else 0)


if __name__ == "__main__":
    main()
