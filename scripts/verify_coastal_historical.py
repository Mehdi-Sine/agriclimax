"""Independent targeted checks from already-published native support exports; no acquisition."""

import argparse
import csv
import json
import math
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--origin", default="http://127.0.0.1:3011")
parser.add_argument(
    "--source", type=Path, default=Path("work/coastal/source/supports.json")
)
parser.add_argument(
    "--output", type=Path, default=Path("docs/codex/task28/evidence/coastal")
)
args = parser.parse_args()
op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
origin = args.origin
dest = args.output
dest.mkdir(parents=True, exist_ok=True)
source = json.loads(args.source.read_text())
days = source["days"]
partial = [r["pra_id"] for r in days["2026-10-31"]["temperature"]]
periods = [
    ("day", "2026-10-31", "2026-10-31"),
    ("five_days", "2026-10-27", "2026-10-31"),
    ("seven_days", "2026-10-25", "2026-10-31"),
    ("thirty_days", "2026-10-02", "2026-10-31"),
]
ids = [
    "temperature_mean",
    "gdd",
    "rain",
    "hot",
    "frost",
    "heavy_rain",
    "dry",
    "dry_sequence",
]
summary = []
inventory = []
checks = 0


def read(params, path="/api/agroclimatic"):
    with op.open(
        origin + path + "?" + urllib.parse.urlencode(params), timeout=180
    ) as r:
        return json.load(r)


def expected(pra, dates, indicator):
    var = "temperature" if indicator in ["temperature_mean", "gdd"] else "precipitation"
    rows = [
        next((r for r in days.get(d, {}).get(var, []) if r["pra_id"] == pra), None)
        for d in dates
    ]
    if indicator in ["hot", "frost"] or any(
        r is None or r["observed_value"] is None or r["temporal_coverage"] != 1
        for r in rows
    ):
        return None, None
    if len({r["support_id"] for r in rows}) != 1:
        return None, None
    vals = [r["observed_value"] for r in rows]
    if indicator == "temperature_mean":
        v = sum(vals) / len(vals)
    elif indicator == "gdd":
        v = sum(max(0, x) for x in vals)
    elif indicator == "rain":
        v = sum(vals)
    elif indicator == "heavy_rain":
        v = sum(x > 20 for x in vals)
    elif indicator == "dry":
        v = sum(x < 1 for x in vals)
    else:
        run = 0
        v = 0
        for x in vals:
            run = run + 1 if x < 1 else 0
            v = max(v, run)
    qualified = (
        indicator in ["temperature_mean", "gdd", "rain"]
        and min(r["coverage"] for r in rows) >= 0.9
    )
    return v if qualified else None, v


for label, start, end in periods:
    dates = [
        str(date.fromisoformat(start) + timedelta(days=i))
        for i in range((date.fromisoformat(end) - date.fromisoformat(start)).days + 1)
    ]
    for indicator in ids:
        payload = read(
            {"indicator": indicator, "temporal": "history", "start": start, "end": end}
        )
        rows = payload["data"]
        assert len(rows) == 713
        (dest / f"{label}-{indicator}.json").write_text(
            json.dumps(
                {
                    "rule": payload["rule"],
                    "period": payload["period"],
                    "data": [r for r in rows if r["territoryId"] in partial],
                },
                indent=2,
            )
        )
        for r in rows:
            if r["territoryId"] not in partial:
                continue
            a, b = expected(r["territoryId"], dates, indicator)
            for actual, exp in [(r["value"], a), (r.get("observed_value"), b)]:
                assert (
                    actual is None
                    if exp is None
                    else actual is not None
                    and math.isclose(actual, exp, abs_tol=1e-9, rel_tol=1e-12)
                ), (indicator, label, r["territoryId"], actual, exp)
            checks += 1
            inventory.append(
                {
                    "period": label,
                    "start": start,
                    "end": end,
                    "indicator": indicator,
                    "pra": r["territoryId"],
                    "value": r["value"],
                    "observed_value": r.get("observed_value"),
                    "spatial_coverage": r.get("spatial_coverage"),
                    "temporal_coverage": r.get("temporal_coverage"),
                    "reason": r["reason"],
                    "support_id": r.get("support_id"),
                }
            )
        summary.append(
            {
                "period": label,
                "start": start,
                "end": end,
                "indicator": indicator,
                "before_strict": 645,
                "after_pra_values": sum(r["value"] is not None for r in rows),
                "after_observed_portion_only": sum(
                    r["value"] is None and r.get("observed_value") is not None
                    for r in rows
                ),
                "after_unavailable": sum(
                    r["value"] is None and r.get("observed_value") is None for r in rows
                ),
            }
        )
        print(
            label,
            indicator,
            summary[-1]["after_pra_values"],
            summary[-1]["after_observed_portion_only"],
            flush=True,
        )
    # Keep a read of the actual previous strict rule, without rerunning unrelated cases.
    old = read(
        {
            "indicator": "gdd",
            "temporal": "history",
            "start": start,
            "end": end,
            "rule_version": "agroclimatic-1.0.0",
        }
    )
    assert sum(r["value"] is not None for r in old["data"]) == 645
    for r in old["data"]:
        assert (
            r["rule_version"] == "agroclimatic-1.0.0"
            and r.get("observed_value") is None
        )
    # Geometry is exposed only if all days have the same real support.
    geom = read(
        {"start": start, "end": end, "variable": "temperature"}, "/api/national/support"
    )
    assert len(geom["collection"]["features"]) == (
        67 if label in ["day", "five_days"] else 0
    )
(dest / "comparison.json").write_text(
    json.dumps(
        {
            "cases": summary,
            "independent_partial_pra_checks": checks,
            "new_acquisitions": 0,
            "strict_version_preserved": True,
            "source_support_days": sorted(days),
        },
        indent=2,
    )
)
with (dest / "residual-inventory.csv").open("w") as f:
    w = csv.DictWriter(f, fieldnames=inventory[0].keys())
    w.writeheader()
    w.writerows(inventory)
print("Independent comparisons", checks)
