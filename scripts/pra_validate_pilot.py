"""Independently check native NetCDF reductions and four-PRA pilot arithmetic offline.

Reads verified local caches; no acquisition or database connection. Does not
validate agronomic thresholds or turn descriptive wheat metrics into risk.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import itertools
import json
import math
from datetime import datetime
from pathlib import Path

import numpy as np
import xarray as xr


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--weights", type=Path, required=True)
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--parameters", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    a = parser.parse_args()
    weights = json.loads(a.weights.read_text())
    names = {
        f["properties"]["code"]: f["properties"]["name"]
        for f in json.loads(a.reference.read_text())["features"]
    }
    parameters = json.loads(a.parameters.read_text())
    selected = {w["cell_id"] for w in weights}
    rows = {}
    files = {}
    maximum_source_error = 0.0
    comparisons = 0
    for archive in sorted((a.root / "tiles").glob("*.json.gz")):
        content = archive.read_bytes()
        if (
            hashlib.sha256(content).hexdigest()
            != archive.with_suffix(".sha256").read_text()
        ):
            raise ValueError("Compact cache checksum mismatch")
        payload = json.loads(gzip.decompress(content))
        receipts = payload["source"]["receipts"]
        if len(receipts) != 1:
            raise ValueError("Pilot validation requires one source month per tile")
        receipt = receipts[0]
        west, south = receipt["request"]["area"][1:3]
        checksum = receipt["checksum"]
        source = a.root / "source-cache/sources" / (checksum + ".source")
        if hashlib.sha256(source.read_bytes()).hexdigest() != checksum:
            raise ValueError("Native NetCDF checksum mismatch")
        files[checksum] = {
            "bytes": source.stat().st_size,
            "request": receipt["request"],
            "retrieved_at": receipt["retrieved_at"],
        }
        with xr.open_dataset(source) as dataset:
            if dataset.t2m.attrs["units"] != "K" or dataset.tp.attrs["units"] != "m":
                raise ValueError("Unexpected source units")
            for row in payload["rows"]:
                if (
                    row["cell_id"] not in selected
                    or math.floor(row["longitude"]) != west
                    or math.floor(row["latitude"]) != south
                ):
                    continue
                key = (row["cell_id"], row["valid_date"])
                if key in rows:
                    raise ValueError("Duplicate native cell/day")
                point = dataset.sel(
                    latitude=row["latitude"],
                    longitude=row["longitude"],
                    method="nearest",
                )
                if (
                    abs(float(point.latitude) - row["latitude"]) > 1e-6
                    or abs(float(point.longitude) - row["longitude"]) > 1e-6
                ):
                    raise ValueError("Grid point was not native")
                stamp = np.datetime64(row["valid_date"])
                values = point.t2m.sel(
                    valid_time=slice(stamp, stamp + np.timedelta64(23, "h"))
                ).values.astype(float)
                complete = len(values) == 24 and bool(np.isfinite(values).all())
                rain = float(point.tp.sel(valid_time=stamp + np.timedelta64(1, "D")))
                expected = {
                    "temperature": float(values.mean()) - 273.15 if complete else None,
                    "temperature_min": float(values.min()) - 273.15
                    if complete
                    else None,
                    "temperature_max": float(values.max()) - 273.15
                    if complete
                    else None,
                    "precipitation": rain * 1000 if math.isfinite(rain) else None,
                }
                for name, value in expected.items():
                    actual = row[name]
                    if value is None:
                        if actual is not None:
                            raise ValueError("Missing native source was fabricated")
                    else:
                        if actual is None or abs(actual - value) > 1e-6:
                            raise ValueError("Native temporal reduction differs")
                        maximum_source_error = max(
                            maximum_source_error, abs(actual - value)
                        )
                    comparisons += 1
                rows[key] = row
    outputs = [
        json.loads(f.read_text())
        for f in sorted((a.root / "batches").glob("*/output.json"))
    ]
    if len(outputs) != 4:
        raise ValueError("Exactly four completed/partial pilot envelopes required")
    cases = []
    maximum_aggregate_error = 0.0
    variables = ["temperature", "temperature_min", "temperature_max", "precipitation"]
    for output in outputs:
        identity = output["identity"]
        latest_source = max(
            datetime.fromisoformat(receipt["retrieved_at"])
            for source in output["source_receipts"].values()
            for receipt in source["receipts"]
        )
        if datetime.fromisoformat(output["computed_at"]) < latest_source:
            raise ValueError("Calculation timestamp precedes acquisition")
        support = [w for w in weights if w["pra_id"] == identity["pra"]]
        dates = [r["valid_date"] for r in output["daily"]]
        details = []
        for daily in output["daily"]:
            metrics = {}
            for index, name in enumerate(variables):
                valid = [
                    (w, rows[(w["cell_id"], daily["valid_date"])][name])
                    for w in support
                    if rows[(w["cell_id"], daily["valid_date"])][name] is not None
                ]
                coverage = sum(w["weight"] for w, _ in valid)
                if name == "temperature_min":
                    observed = min((v for _, v in valid), default=None)
                elif name == "temperature_max":
                    observed = max((v for _, v in valid), default=None)
                else:
                    observed = (
                        sum(w["weight"] * v for w, v in valid) / coverage
                        if valid
                        else None
                    )
                expected = observed if len(valid) == len(support) else None
                actual = daily[name]
                if expected is None:
                    if actual is not None:
                        raise ValueError("Partial PRA was presented as complete")
                else:
                    if actual is None or abs(actual - expected) > 1e-6:
                        raise ValueError("PRA spatial reduction differs")
                    maximum_aggregate_error = max(
                        maximum_aggregate_error, abs(actual - expected)
                    )
                if (
                    daily["valid_counts"][index] != len(valid)
                    or abs(daily["coverage"][index] - coverage) > 1e-6
                ):
                    raise ValueError("Invalid weighted completeness")
                metrics[name] = {
                    "valid_cells": len(valid),
                    "weighted_coverage": coverage,
                    "observed_value_not_full_pra": observed,
                }
            details.append({"valid_date": daily["valid_date"], "variables": metrics})
        metric_values = {}
        for w in support:
            series = {
                name: [rows[(w["cell_id"], day)][name] for day in dates]
                for name in variables
            }
            values = {}
            for variable, prefix, threshold, direction in [
                ("temperature_max", "heat", parameters["heat_threshold_c"], "above"),
                ("temperature_min", "frost", parameters["frost_threshold_c"], "below"),
                ("precipitation", "dry", parameters["dry_threshold_mm"], "below"),
            ]:
                data = series[variable]
                available = all(v is not None for v in data)
                flags = (
                    [
                        v > threshold if direction == "above" else v < threshold
                        for v in data
                    ]
                    if available
                    else []
                )
                lengths = [
                    sum(1 for _ in group)
                    for flag, group in itertools.groupby(flags)
                    if flag
                ]
                minimum = 1 if prefix == "dry" else parameters["spell_min_days"]
                values[prefix + "_days"] = sum(flags) if available else None
                values[prefix + "_spell_max"] = (
                    max((n for n in lengths if n >= minimum), default=0)
                    if available
                    else None
                )
            values["gdd"] = (
                sum(max(v - parameters["gdd_base_c"], 0) for v in series["temperature"])
                if all(v is not None for v in series["temperature"])
                else None
            )
            values["precipitation_sum"] = (
                sum(series["precipitation"])
                if all(v is not None for v in series["precipitation"])
                else None
            )
            metric_values[w["cell_id"]] = values
        for diagnostic in output["diagnostics"]:
            metric = diagnostic["indicator_id"].removeprefix("wheat.")
            valid = [
                (w, metric_values[w["cell_id"]][metric])
                for w in support
                if metric_values[w["cell_id"]][metric] is not None
            ]
            coverage = sum(w["weight"] for w, _ in valid)
            expected = (
                sum(w["weight"] * v for w, v in valid) / coverage
                if len(valid) == len(support)
                else None
            )
            if expected is None:
                if diagnostic["value"] is not None:
                    raise ValueError("Diagnostic fabricated missing support")
            elif (
                diagnostic["value"] is None
                or abs(diagnostic["value"] - expected) > 1e-6
            ):
                raise ValueError("Native-before-space wheat diagnostic differs")
        cases.append(
            {
                "pra_id": identity["pra"],
                "name": names[identity["pra"][4:]],
                "batch_key": output["batch_key"],
                "computed_at": output["computed_at"],
                "daily": output["daily"],
                "diagnostics": output["diagnostics"],
                "native_support": len(support),
                "completeness_details": details,
                "cattle_status": output["cattle_status"],
                "scientific_status": "exploratory",
                "risk_computed": False,
            }
        )
    periods = {
        (output["identity"]["start"], output["identity"]["end"]) for output in outputs
    }
    if len(periods) != 1:
        raise ValueError("Pilot periods differ")
    period = next(iter(periods))
    expected_rows = len(selected) * len(outputs[0]["daily"])
    if len(rows) != expected_rows:
        raise ValueError("Incomplete native seven-day pilot support")
    report = {
        "real_cds": True,
        "synthetic": False,
        "period_utc": list(period),
        "native_cells": len(selected),
        "native_cell_days": len(rows),
        "native_variable_comparisons": comparisons,
        "maximum_source_reduction_error": maximum_source_error,
        "maximum_spatial_aggregate_error": maximum_aggregate_error,
        "parameters_sha256": hashlib.sha256(
            json.dumps(parameters, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest(),
        "parameter_source": parameters["parameter_source"],
        "source_files": files,
        "national_operational_validation": "not_executed",
        "cases": sorted(cases, key=lambda c: c["pra_id"]),
    }
    # Use the authoritative existing parameter fingerprint convention.
    from agriclimax.wheat.models import Parameters

    report["parameters_sha256"] = Parameters.model_validate(parameters).fingerprint()
    a.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    )
    print(
        json.dumps(
            {
                "cases": len(cases),
                "native_cell_days": len(rows),
                "source_files": len(files),
                "native_variable_comparisons": comparisons,
                "maximum_source_reduction_error": maximum_source_error,
            }
        )
    )


if __name__ == "__main__":
    main()
