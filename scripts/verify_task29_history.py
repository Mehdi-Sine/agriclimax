"""Read-only final matrix and independent affected-PRA arithmetic; no acquisition."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from era5_spatial_restitution import native_rows

IDS = [
    "gdd",
    "hot",
    "hot_sequence",
    "frost",
    "frost_sequence",
    "rain",
    "heavy_rain",
    "dry",
    "dry_sequence",
    "thi",
    "thi_days",
    "thi_sequence",
    "cattle_heat",
    "temperature_mean",
]
PERIODS = [("day", "2026-10-31"), ("seven", "2026-10-25"), ("thirty", "2026-10-02")]
END = "2026-10-31"


def reduced(values: list[float], operator: str, threshold: float | None) -> float:
    if operator == "mean":
        return sum(values) / len(values)
    if operator == "sum":
        return sum(values)
    if operator == "gdd":
        return sum(max(0, v - float(threshold or 0)) for v in values)
    selected = [
        v > float(threshold or 0)
        if operator in {"above", "longestAbove"}
        else v < float(threshold or 0)
        for v in values
    ]
    if operator in {"above", "below"}:
        return float(sum(selected))
    run = longest = 0
    for flag in selected:
        run = run + 1 if flag else 0
        longest = max(run, longest)
    return float(longest)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--origin", default="http://127.0.0.1:3015")
    p.add_argument("--native-root", action="append", type=Path, required=True)
    p.add_argument("--output", type=Path, default=Path("docs/codex/task29/evidence"))
    args = p.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    native, shas, _ = native_rows(tuple(args.native_root))
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for w in json.loads(
        Path(
            "config/coverage/ofb-masa-pra-2017-snapshot-20261017/weights.json"
        ).read_text()
    ):
        groups[w["pra_id"]].append(w)
    baseline = json.loads(
        Path("apps/web/data/operational/era5-spatial-support.json").read_text()
    )
    affected = {r["pra_id"] for r in baseline["days"]["2026-10-27"]["temperature"]}
    expected_ids = set(
        json.loads(Path("apps/web/data/operational/pra-identities.json").read_text())[
            "ids"
        ]
    )
    matrix: list[dict[str, Any]] = []
    summaries = []
    checks = 0

    def read(
        params: dict[str, Any], path: str = "/api/agroclimatic"
    ) -> tuple[dict[str, Any], str]:
        with urllib.request.urlopen(
            args.origin + path + "?" + urllib.parse.urlencode(params), timeout=180
        ) as response:
            raw = response.read()
        return json.loads(raw), hashlib.sha256(raw).hexdigest()

    def verify(
        case: tuple[str, str, str],
    ) -> tuple[list[dict[str, Any]], dict[str, Any], int]:
        label, start, indicator = case
        payload, sha = read({"indicator": indicator, "start": start, "end": END})
        assert {r["territoryId"] for r in payload["data"]} == expected_ids
        assert len(payload["data"]) == 713
        rule = payload["rule"]
        days = [
            str(date.fromisoformat(start) + timedelta(days=i))
            for i in range(
                (date.fromisoformat(END) - date.fromisoformat(start)).days + 1
            )
        ]
        counts: Counter[str] = Counter()
        output = []
        compared = 0
        for row in payload["data"]:
            pra = row["territoryId"]
            if pra in affected:
                expected = observed = None
                if "humidity" not in rule["variables"]:
                    variable = rule["variables"][0]
                    daily: list[float | None] = []
                    supports = []
                    coverages = []
                    for day in days:
                        pairs = [
                            (w, native.get((w["cell_id"], day), {}).get(variable))
                            for w in groups[pra]
                        ]
                        valid = [(w, v) for w, v in pairs if v is not None]
                        cov = sum(w["weight"] for w, _ in valid)
                        coverages.append(cov)
                        supports.append(tuple(sorted(w["cell_id"] for w, _ in valid)))
                        if not valid:
                            daily.append(None)
                        elif variable == "temperature_min":
                            daily.append(min(v for _, v in valid))
                        elif variable == "temperature_max":
                            daily.append(max(v for _, v in valid))
                        else:
                            daily.append(sum(w["weight"] * v for w, v in valid) / cov)
                    if None not in daily and len(set(supports)) == 1:
                        observed = reduced(
                            [v for v in daily if v is not None],
                            rule["operator"],
                            payload["parameters"]["threshold"],
                        )
                        if (
                            indicator in {"temperature_mean", "gdd", "rain"}
                            and min(coverages) >= 0.9
                        ):
                            expected = observed
                for actual, target in [
                    (row["value"], expected),
                    (row.get("observed_value"), observed),
                ]:
                    assert (
                        actual is None
                        if target is None
                        else actual is not None
                        and math.isclose(actual, target, abs_tol=1e-9, rel_tol=1e-12)
                    ), (label, indicator, pra, actual, target)
                compared += 1
            comp = row.get("complementary")
            category = (
                "qualified"
                if row.get("support_scope") == "qualified_pra_estimate"
                and row["value"] is not None
                else "complete"
                if row["value"] is not None
                else "portion"
                if row.get("observed_value") is not None
                else "complementary"
                if comp
                else "unavailable"
            )
            if comp:
                assert pra == "pra:29102" and indicator in {
                    "temperature_mean",
                    "gdd",
                    "rain",
                }
                assert (
                    row["value"] is None
                    and row.get("observed_value") is None
                    and comp["native_spatial_coverage"] == 0
                )
                assert comp["days"] == len(days) and comp["temporal_coverage"] == 1
            counts[category] += 1
            output.append(
                {
                    "period": label,
                    "start_utc": start,
                    "end_utc": END,
                    "indicator": indicator,
                    "pra": pra,
                    "category": category,
                    "value": row["value"],
                    "observed_value": row.get("observed_value"),
                    "complementary_value": comp["value"] if comp else None,
                    "unit": row["unit"],
                    "spatial_coverage": row.get("spatial_coverage"),
                    "temporal_coverage": row.get("temporal_coverage", row["coverage"]),
                    "observed_days": row["observedDays"],
                    "expected_days": row["expectedDays"],
                    "rule_version": row["rule_version"],
                    "support_id": row.get("support_id"),
                    "complementary_method": comp["method_version"] if comp else None,
                    "reason": row["reason"],
                    "provenance_sha256": hashlib.sha256(
                        json.dumps(row["provenance"]).encode()
                    ).hexdigest(),
                }
            )
        summary = {
            "period": label,
            "indicator": indicator,
            "counts": dict(counts),
            "response_sha256": sha,
            "affected_pra_compared": compared,
        }
        print(label, indicator, dict(counts), flush=True)
        return output, summary, compared

    cases = [(label, start, indicator) for label, start in PERIODS for indicator in IDS]
    with ThreadPoolExecutor(max_workers=2) as pool:
        for output, summary, compared in pool.map(verify, cases):
            matrix.extend(output)
            summaries.append(summary)
            checks += compared
    assert len(matrix) == 713 * 14 * 3
    for name, rows in [
        ("availability-by-pra.csv", matrix),
        (
            "unavailable-by-pra.csv",
            [r for r in matrix if r["category"] == "unavailable"],
        ),
    ]:
        with (args.output / name).open("w") as output:
            writer = csv.DictWriter(output, fieldnames=list(matrix[0]))
            writer.writeheader()
            writer.writerows(rows)
    legacy = []
    for label, start in PERIODS:
        payload, _ = read(
            {
                "indicator": "gdd",
                "start": start,
                "end": END,
                "rule_version": "agroclimatic-1.0.0",
            }
        )
        assert sum(r["value"] is not None for r in payload["data"]) == 645
        assert all(not r.get("complementary") for r in payload["data"])
        legacy.append({"period": label, "strict_1_0_values": 645})
        for variable in [
            "temperature",
            "temperature_min",
            "temperature_max",
            "precipitation",
        ]:
            geom, _ = read(
                {"start": start, "end": END, "variable": variable},
                "/api/national/support",
            )
            assert geom["verified"] and len(geom["collection"]["features"]) == 67
            assert not any(
                f["id"] == "pra:29102" for f in geom["collection"]["features"]
            )
    previous, _ = read(
        {
            "indicator": "gdd",
            "start": "2026-10-25",
            "end": END,
            "rule_version": "agroclimatic-1.1.0",
        }
    )
    assert sum(r["value"] is not None for r in previous["data"]) == 645
    assert not any(r.get("complementary") for r in previous["data"])
    report = {
        "cases": summaries,
        "matrix_rows": len(matrix),
        "independent_affected_pra_comparisons": checks,
        "native_manifest_sha256": hashlib.sha256(
            json.dumps(sorted(shas)).encode()
        ).hexdigest(),
        "strict_versions": legacy,
        "previous_1_1_seven_day_values": 645,
        "new_acquisitions": 0,
        "database_writes": 0,
    }
    (args.output / "final-matrix-summary.json").write_text(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
