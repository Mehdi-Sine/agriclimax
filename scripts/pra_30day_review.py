"""Read-only composite verification and measurements; preserves both source editions."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import statistics
import time
from collections import Counter
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import xarray as xr
from agriclimax.territories.aggregate import aggregate, wheat_native
from agriclimax.territories.pipeline import VARIABLES
from agriclimax.territories.spatial import Weight
from agriclimax.wheat.models import Parameters
from pra_30day_run import BUNDLE, EDITION, END, ROOT, SAMPLE, START

OLD_ROOT = Path("work/task19b/real")
OLD_EDITION = "era5land-pilot73-20261012-20261018-v1"
LAST = date(2026, 10, 18)


def read_outputs(root: Path, destination: str) -> list[dict[str, Any]]:
    outputs = []
    expected = None
    if root == OLD_ROOT and destination == "supabase":
        expected = json.loads(
            Path("docs/codex/verification/task19b/evidence.json").read_text()
        )["remote_validation"]["output_sha256"]
    for path in sorted(root.glob("batches/*/output.json")):
        output = json.loads(path.read_text())
        if output["identity"]["destination"] != destination:
            continue
        if expected is not None and hashlib.sha256(
            path.read_bytes()
        ).hexdigest() != expected.get(output["batch_key"]):
            raise ValueError("Validated Task19B publication changed")
        outputs.append(output)
    return outputs


def boundary_equal(
    new_root: Path, old_root: Path, expected_groups: int = 27
) -> dict[str, Any]:
    """The shared October 12 hourly source day must be exactly identical, including NaNs."""

    def receipts(root: Path) -> list[dict[str, Any]]:
        return [
            json.loads(p.read_text())
            for p in (root / "source-cache/requests").glob("*.json")
        ]

    old = [
        r
        for r in receipts(old_root)
        if r["request"]["day"] == [str(d) for d in range(12, 20)]
    ]
    new = [
        r
        for r in receipts(new_root)
        if r["request"]["month"] == "10"
        and r["request"]["day"] == [f"{d:02}" for d in range(1, 13)]
    ]
    if len(new) != expected_groups:
        raise ValueError("All expected source boundaries required")
    comparisons = 0
    for nr in new:
        matches = [r for r in old if r["request"]["area"] == nr["request"]["area"]]
        if len(matches) != 1:
            raise ValueError("Missing or ambiguous historical source extent")
        paths = []
        for root, receipt in [(new_root, nr), (old_root, matches[0])]:
            path = root / "source-cache/sources" / (receipt["checksum"] + ".source")
            if hashlib.sha256(path.read_bytes()).hexdigest() != receipt["checksum"]:
                raise ValueError("Source boundary checksum mismatch")
            paths.append(path)
        with xr.open_dataset(paths[0]) as a, xr.open_dataset(paths[1]) as b:
            for coord in ["latitude", "longitude"]:
                if not np.allclose(a[coord].values, b[coord].values, rtol=0, atol=1e-6):
                    raise ValueError("Different native grid at edition boundary")
            for var in ["t2m", "tp"]:
                av = (
                    a[var]
                    .sel(valid_time=slice("2026-10-12T00:00", "2026-10-12T23:00"))
                    .values
                )
                bv = (
                    b[var]
                    .sel(valid_time=slice("2026-10-12T00:00", "2026-10-12T23:00"))
                    .values
                )
                if av.shape[0] != 24 or not np.array_equal(av, bv, equal_nan=True):
                    raise ValueError(
                        "Different hourly weather at edition boundary; cannot merge"
                    )
                comparisons += av.size
    return {
        "groups": expected_groups,
        "hourly_field_values": comparisons,
        "exact_including_missing_masks": True,
        "day": "2026-10-12",
    }


def composite(old: list[dict[str, Any]], new: list[dict[str, Any]]) -> dict[str, Any]:
    sample = json.loads(SAMPLE.read_text())
    ids = {s["id"] for s in sample["selection"]}
    if len(old) != 73 or len(new) != 292:
        raise ValueError("73 reused plus 292 new batches required")
    physical = {
        k: v for k, v in old[0]["identity"]["dataset"].items() if k != "dataset_version"
    }
    basis = {o["identity"]["pra"]: o["identity"] for o in old}
    expected_dates = {str(START + timedelta(days=i)) for i in range(30)}
    by_pra: dict[str, dict[str, dict[str, Any]]] = {pid: {} for pid in ids}
    lineages: dict[str, list[str]] = {pid: [] for pid in ids}
    for output in old + new:
        identity = output["identity"]
        pid = identity["pra"]
        edition = identity["dataset"]["dataset_version"]
        if pid not in ids or edition not in {EDITION, OLD_EDITION}:
            raise ValueError("Wrong selection/edition")
        if {
            k: v for k, v in identity["dataset"].items() if k != "dataset_version"
        } != physical:
            raise ValueError("Different physical dataset identity")
        for key in ["reference_geometry_sha256", "weights_sha256", "method"]:
            if identity[key] != basis[pid][key]:
                raise ValueError("Reference, weights or method changed across editions")
        if edition == EDITION and (
            identity["parameters"] is not None or output["diagnostics"]
        ):
            raise ValueError("New systematic diagnostics forbidden")
        for row in output["daily"]:
            day = row["valid_date"]
            if (edition == EDITION) != (str(START) <= day <= str(END)):
                raise ValueError("Edition/date mapping differs")
            if pid != row["pra_id"] or day in by_pra[pid]:
                raise ValueError("Duplicate or wrong PRA day")
            for i, v in enumerate(VARIABLES):
                if (
                    row["valid_counts"][i] < row["expected_cells"]
                    and row[v] is not None
                ):
                    raise ValueError("Incomplete support presented as complete")
            by_pra[pid][day] = dict(
                row,
                source_dataset_version=edition,
                batch_key=output["batch_key"],
                computed_at=output["computed_at"],
            )
        lineages[pid].append(output["batch_key"])
    if any(set(rows) != expected_dates for rows in by_pra.values()):
        raise ValueError("Missing or overlapping composite PRA dates")

    def state(row: dict[str, Any]) -> str:
        return (
            "unavailable"
            if all(n == 0 for n in row["valid_counts"])
            else "complete"
            if row["status"] == "available"
            else "partial"
        )

    return {
        "component_editions": [
            {"dataset": EDITION, "from": str(START), "to": str(END)},
            {"dataset": OLD_EDITION, "from": "2026-10-12", "to": str(LAST)},
        ],
        "physical_identity": physical,
        "reference_version": sample["reference_version"],
        "selection_sha256": hashlib.sha256(SAMPLE.read_bytes()).hexdigest(),
        "pra": 73,
        "pra_days": 2190,
        "states": dict(
            Counter(state(r) for rows in by_pra.values() for r in rows.values())
        ),
        "availability": [
            {
                "pra": pid,
                "states": dict(Counter(state(r) for r in rows.values())),
                "minimum_coverage": [
                    min(r["coverage"][i] for r in rows.values()) for i in range(4)
                ],
            }
            for pid, rows in sorted(by_pra.items())
        ],
        "lineages": lineages,
    }


def native_rows(new_root: Path) -> dict[tuple[str, str], dict[str, Any]]:
    ids = {r["id"] for r in json.loads(SAMPLE.read_text())["selection"]}
    cells = {
        w["cell_id"]
        for w in json.loads((BUNDLE / "weights.json").read_text())
        if w["pra_id"] in ids
    }
    result = {}
    for root in [OLD_ROOT, new_root]:
        for path in sorted((root / "tiles").glob("*.json.gz")):
            if (
                hashlib.sha256(path.read_bytes()).hexdigest()
                != path.with_suffix(".sha256").read_text()
            ):
                raise ValueError("Tile checksum mismatch")
            for row in json.loads(gzip.decompress(path.read_bytes()))["rows"]:
                if row["cell_id"] not in cells:
                    continue
                key = (row["cell_id"], row["valid_date"])
                if key in result:
                    raise ValueError("Duplicate native day across editions")
                result[key] = row
    dates = {str(START + timedelta(days=i)) for i in range(30)}
    if set(result) != {(cell, day) for cell in cells for day in dates}:
        raise ValueError("Incomplete native 30-day support")
    return result


def diagnostic(
    pid: str,
    rows: dict[tuple[str, str], dict[str, Any]],
    weights: list[Weight],
    parameters: Parameters,
    lineages: list[str],
) -> dict[str, Any]:
    support = [w for w in weights if w.pra_id == pid]
    if not support:
        raise ValueError("PRA outside verified selection")
    days = [str(START + timedelta(days=i)) for i in range(30)]
    native = {
        w.cell_id: wheat_native(
            {v: [rows[w.cell_id, d][v] for d in days] for v in VARIABLES},
            parameters,
            30,
        )
        for w in support
    }
    return {
        "pra": pid,
        "from": str(START),
        "to": str(LAST),
        "rule_version": parameters.rule_version,
        "parameters_sha256": parameters.fingerprint(),
        "data_freshness": "stale",
        "provenance": {
            "source_id": "era5-land",
            "component_editions": [EDITION, OLD_EDITION],
            "batches": lineages,
        },
        "quality_flags": ["on_demand", "native_before_period_and_space"],
        "scientific_status": "exploratory",
        "risk_computed": False,
        "confidence": "low",
        "indicators": {
            name: aggregate(
                support, {cell: m[name] for cell, m in native.items()}, "spatial_mean"
            ).document()
            | {
                "unit": "degC day"
                if name == "gdd"
                else "mm"
                if name == "precipitation_sum"
                else "day"
            }
            for name in next(iter(native.values()))
        },
    }


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root", type=Path, default=ROOT)
    p.add_argument("--destination", choices=["local", "supabase"], default="local")
    p.add_argument("--output", type=Path, default=Path("work/task19c/composite.json"))
    p.add_argument(
        "--diagnostics",
        action="store_true",
        help="Measure on-demand computation only; never persist",
    )
    a = p.parse_args()
    begin = time.monotonic()
    result = composite(
        read_outputs(OLD_ROOT, "supabase"), read_outputs(a.root, a.destination)
    )
    result["boundary"] = boundary_equal(a.root, OLD_ROOT)
    result["verification_seconds"] = time.monotonic() - begin
    if a.diagnostics:
        mark = time.monotonic()
        rows = native_rows(a.root)
        load_seconds = time.monotonic() - mark
        parameters = Parameters.model_validate_json(
            Path("config/wheat-mvp.json").read_text()
        )
        selected = set(result["lineages"])
        weights = [
            Weight(**w)
            for w in json.loads((BUNDLE / "weights.json").read_text())
            if w["pra_id"] in selected
        ]
        timings = []
        ordered = sorted(selected)
        for count in [1, 10, 73]:
            values = []
            for _ in range(3):
                mark = time.monotonic()
                outputs = [
                    diagnostic(pid, rows, weights, parameters, result["lineages"][pid])
                    for pid in ordered[:count]
                ]
                values.append(time.monotonic() - mark)
            timings.append(
                {
                    "pra": count,
                    "milliseconds": [1000 * v for v in values],
                    "median_ms": 1000 * statistics.median(values),
                    "json_bytes": len(json.dumps(outputs).encode()),
                }
            )
        result["diagnostics_on_demand"] = {
            "persisted": False,
            "native_cache_load_seconds": load_seconds,
            "native_cell_days": len(rows),
            "timings": timings,
            "example": diagnostic(
                "pra:28341", rows, weights, parameters, result["lineages"]["pra:28341"]
            ),
        }
    atomic = json.dumps(result, indent=2, allow_nan=False) + "\n"
    a.output.parent.mkdir(parents=True, exist_ok=True)
    a.output.write_text(atomic)
    print(
        json.dumps(
            {
                k: v
                for k, v in result.items()
                if k not in {"availability", "lineages", "diagnostics_on_demand"}
            }
        )
    )


if __name__ == "__main__":
    main()
