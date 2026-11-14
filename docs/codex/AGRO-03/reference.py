"""Independent arithmetic oracle for AGRO-03, reusing frozen AGRO-02 input checks.

No application import. Standard library only. Production algorithms are TypeScript.
"""
import importlib.util
import itertools
import json
import math
import sys
from pathlib import Path
from typing import Any

spec = importlib.util.spec_from_file_location(
    "agro02_reference", Path(__file__).parents[1] / "AGRO-02/reference.py"
)
assert spec and spec.loader
legacy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy)


def reference(
    rows: list[dict[str, Any]],
    period: tuple[str, str],
    rule: dict[str, Any],
) -> float | int | None:
    operator = rule["operator"]
    if operator not in ("atLeast", "longestAtLeast", "max"):
        return legacy.reference(rows, period, rule)
    # The independent legacy checks reject incomplete/heterogeneous input first.
    if legacy.reference(rows, period, {**rule, "operator": "mean"}) is None:
        return None
    values = [r["values"][rule["variables"][0]] for r in sorted(rows, key=lambda r: r["date"])]
    if operator == "max":
        return max(values)
    hits = [x >= rule["threshold"] for x in values]
    if operator == "atLeast":
        return sum(hits)
    return max((len(list(g)) for hit, g in itertools.groupby(hits) if hit), default=0)


def main() -> int:
    payload = json.load(sys.stdin)
    errors = []
    for i, case in enumerate(payload["cases"]):
        rows = payload["inputs"].get(case["input"], {}).get(case["pra"], [])
        rows = [r for r in rows if case["period"][0] <= r["date"] <= case["period"][1]]
        rule = payload["rules"][case["recipe"]]
        expected = reference(rows, case["period"], rule)
        if rule["coverage_family"] == "specific" and rows and rows[0].get("climate_support", {}).get("fraction", 0) < .9999:
            expected = None
        actual = case["observed"] if case["state"] == "observed_partial" else case["value"]
        same = expected is actual if expected is None or actual is None else math.isclose(expected, actual, rel_tol=1e-12, abs_tol=1e-9)
        if not same:
            errors.append({"case": i, "expected": expected, "actual": actual})
    print(json.dumps({"cases": len(payload["cases"]), "mismatches": len(errors), "examples": errors[:10]}))
    return int(bool(errors))


if __name__ == "__main__":
    sys.exit(main())
