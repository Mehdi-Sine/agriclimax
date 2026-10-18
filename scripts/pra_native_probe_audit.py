"""Offline availability at a few CDS instants, never a structural coverage certificate."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import xarray as xr


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--netcdf", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    a = parser.parse_args()
    receipt = json.loads(a.receipt.read_text())
    if hashlib.sha256(a.netcdf.read_bytes()).hexdigest() != receipt["sha256"]:
        raise ValueError("Native probe checksum mismatch")
    for name, checksum in json.loads((a.bundle / "checksums.json").read_text()).items():
        if hashlib.sha256((a.bundle / name).read_bytes()).hexdigest() != checksum:
            raise ValueError("Reference bundle checksum mismatch")
    weights = json.loads((a.bundle / "weights.json").read_text())
    reference = json.loads((a.bundle / "reference.json").read_text())
    cells = {w["cell_id"]: w for w in weights}
    availability: dict[str, Any] = {}
    with xr.open_dataset(a.netcdf) as ds:
        dimension = "valid_time" if "valid_time" in ds.dims else "time"
        if (
            ds.sizes[dimension] != 2
            or ds.t2m.attrs["units"] != "K"
            or ds.tp.attrs["units"] != "m"
        ):
            raise ValueError("Expected exactly two instants with native units")
        stamps = [
            np.datetime_as_string(t, unit="s") + "Z" for t in ds[dimension].values
        ]
        if stamps != ["2026-10-01T12:00:00Z", "2026-10-07T12:00:00Z"]:
            raise ValueError("Unexpected probe instants")
        for cell, w in cells.items():
            indices = {}
            for axis in ["latitude", "longitude"]:
                matches = np.flatnonzero(np.abs(ds[axis].values - w[axis]) < 1e-6)
                if len(matches) != 1:
                    raise ValueError(
                        "Native coordinate absent or ambiguous; no nearest-neighbour filling"
                    )
                indices[axis] = int(matches[0])
            point = ds.isel(**indices)
            present = {
                v: [bool(math.isfinite(float(n))) for n in point[v].values.reshape(-1)]
                for v in ["t2m", "tp"]
            }
            availability[cell] = present
    rows = []
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for w in weights:
        grouped[w["pra_id"]].append(w)
    for f in reference["features"]:
        p = f["properties"]
        ws = grouped["pra:" + p["code"]]
        coverage = [
            min(
                1.0,
                sum(
                    w["weight"]
                    for w in ws
                    if all(availability[w["cell_id"]][v][i] for v in ["t2m", "tp"])
                ),
            )
            for i in range(2)
        ]
        value = min(coverage)
        category = (
            "zero"
            if value == 0
            else "below_90"
            if value < 0.9
            else "90_to_below_99"
            if value < 0.99
            else "at_least_99"
        )
        rows.append(
            {
                "code": p["code"],
                "name": p["name"],
                "department": p["department"],
                "observed_fraction_oct01": coverage[0],
                "observed_fraction_oct07": coverage[1],
                "minimum_observed_fraction": value,
                "observed_category": category,
                "structural_coverage": None,
                "structural_status": "unknown_mask_not_verified",
            }
        )
    a.output.mkdir(parents=True, exist_ok=True)
    with (a.output / "native-probe-pra.csv").open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    absent = {
        cell: values
        for cell, values in availability.items()
        if not all(x for v in values.values() for x in v)
    }
    report = {
        "scope": "Two temporal instants only; no daily or diagnostic calculation",
        "receipt": receipt,
        "pra_count": len(rows),
        "native_cells": len(cells),
        "instants": stamps,
        "cell_missing_any_variable_instant": len(absent),
        "cell_missing_all_variables_both_instants": sum(
            not any(x for v in values.values() for x in v) for values in absent.values()
        ),
        "observed_bins": dict(Counter(row["observed_category"] for row in rows)),
        "structural_classification_established": False,
        "missing_cells": absent,
        "pra_below_99_observed": [
            r for r in rows if r["minimum_observed_fraction"] < 0.99
        ],
        "interpolation": False,
        "weight_renormalization": False,
    }
    (a.output / "native-probe-audit.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    )
    print(
        json.dumps(
            {
                k: v
                for k, v in report.items()
                if k not in ["receipt", "missing_cells", "pra_below_99_observed"]
            }
        )
    )


if __name__ == "__main__":
    main()
