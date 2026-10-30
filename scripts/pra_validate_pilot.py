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
from collections.abc import Iterator
from contextlib import ExitStack, contextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import xarray as xr


@contextmanager
def source_months(
    root: Path, source: dict[str, Any], identity: dict[str, Any]
) -> Iterator[xr.Dataset]:
    """Independently verify request identity, native grid, checksums and hourly continuity."""
    receipts = source["receipts"]
    if (
        not receipts
        or len(receipts) > 2
        or source["catalogue"] != "reanalysis-era5-land"
    ):
        raise ValueError("One or two coherent ERA5-Land months required")
    if sorted(r["checksum"] for r in receipts) != source["source_checksums"]:
        raise ValueError("Source checksum manifest differs")
    with ExitStack() as stack:
        loaded = []
        physical_request = None
        for receipt in receipts:
            request = receipt["request"]
            physical = {
                k: v for k, v in request.items() if k not in {"year", "month", "day"}
            }
            if physical_request is not None and physical != physical_request:
                raise ValueError("Monthly request semantics differ")
            physical_request = physical
            if (
                request["variable"] != ["2m_temperature", "total_precipitation"]
                or request["time"] != [f"{h:02}:00" for h in range(24)]
                or request["product_type"] != "reanalysis"
            ):
                raise ValueError("Unexpected source request semantics")
            request_id = hashlib.sha256(
                json.dumps(
                    {"request": request, "dataset": identity}, sort_keys=True
                ).encode()
            ).hexdigest()
            persisted = json.loads(
                (root / "source-cache/requests" / (request_id + ".json")).read_text()
            )
            if persisted != receipt:
                raise ValueError("Monthly receipt/dataset identity mismatch")
            path = root / "source-cache/sources" / (receipt["checksum"] + ".source")
            if hashlib.sha256(path.read_bytes()).hexdigest() != receipt["checksum"]:
                raise ValueError("Native NetCDF checksum mismatch")
            ds = stack.enter_context(xr.open_dataset(path))
            if set(ds.dims) != {"valid_time", "latitude", "longitude"} or set(
                ds.data_vars
            ) != {"t2m", "tp"}:
                raise ValueError("Unexpected native dimensions or fields")
            if ds.t2m.attrs.get("units") != "K" or ds.tp.attrs.get("units") != "m":
                raise ValueError("Unexpected source units")
            stamps = np.array(
                [
                    np.datetime64(f"{request['year']}-{request['month']}-{day}T{hour}")
                    for day in request["day"]
                    for hour in request["time"]
                ],
                dtype="datetime64[ns]",
            )
            if not np.array_equal(ds.valid_time.values, stamps):
                raise ValueError("Monthly hourly support differs from exact request")
            loaded.append(ds)
        merged = xr.concat(loaded, dim="valid_time", join="exact").sortby("valid_time")
        times = merged.valid_time.values.astype("datetime64[ns]")
        expected = np.arange(
            times[0], times[-1] + np.timedelta64(1, "h"), np.timedelta64(1, "h")
        )
        if not np.array_equal(times, expected):
            raise ValueError("Duplicate timestamps or silent inter-month gap")
        yield merged


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--expected-windows", type=int, choices=[1, 4, 5], default=1)
    parser.add_argument("--expected-pra", type=int, choices=[73, 713], default=73)
    parser.add_argument("--require-no-diagnostics", action="store_true")
    parser.add_argument("--sample", type=Path, help="Versioned larger pilot selection")
    parser.add_argument("--destination", choices=["local", "supabase"])
    parser.add_argument("--weights", type=Path, required=True)
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--parameters", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    a = parser.parse_args()
    weights = json.loads(a.weights.read_text())
    sample_ids = None
    if a.sample:
        sample = json.loads(a.sample.read_text())
        sample_ids = {r["id"] for r in sample["selection"]}
        if len(sample_ids) != a.expected_pra:
            raise ValueError("Expected the explicitly selected PRA count")
        weights = [w for w in weights if w["pra_id"] in sample_ids]
    names = {
        f["properties"]["code"]: f["properties"]["name"]
        for f in json.loads(a.reference.read_text())["features"]
    }
    parameters = json.loads(a.parameters.read_text())
    outputs = [
        json.loads(f.read_text())
        for f in sorted((a.root / "batches").glob("*/output.json"))
    ]
    if a.destination:
        outputs = [o for o in outputs if o["identity"]["destination"] == a.destination]
    if not outputs:
        raise ValueError("Missing pilot envelopes")
    dataset_identity = outputs[0]["identity"]["dataset"]
    if any(o["identity"]["dataset"] != dataset_identity for o in outputs):
        raise ValueError("Cannot silently merge different dataset editions")
    if a.require_no_diagnostics and any(o["diagnostics"] for o in outputs):
        raise ValueError("No new systematic diagnostics permitted")
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
        west, south = receipts[0]["request"]["area"][1:3]
        for receipt in receipts:
            checksum = receipt["checksum"]
            path = a.root / "source-cache/sources" / (checksum + ".source")
            files[checksum] = {
                "bytes": path.stat().st_size,
                "request": receipt["request"],
                "retrieved_at": receipt["retrieved_at"],
            }
        with source_months(a.root, payload["source"], dataset_identity) as dataset:
            for row in payload["rows"]:
                if row["cell_id"] not in selected or (
                    not a.sample
                    and (
                        math.floor(row["longitude"]) != west
                        or math.floor(row["latitude"]) != south
                    )
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
    expected_count = (
        a.expected_pra if sample_ids is not None else 4
    ) * a.expected_windows
    if len(outputs) != expected_count or (
        sample_ids is not None and {o["identity"]["pra"] for o in outputs} != sample_ids
    ):
        raise ValueError("Missing, duplicate or out-of-sample pilot envelopes")
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
    if len(periods) != a.expected_windows:
        raise ValueError("Unexpected number of pilot windows")
    ordered = sorted(periods)
    for previous, current in itertools.pairwise(ordered):
        if datetime.fromisoformat(current[0]) - datetime.fromisoformat(
            previous[1]
        ) != timedelta(days=1):
            raise ValueError("Discontinuous or overlapping batch windows")
    period = (ordered[0][0], ordered[-1][1])
    expected_dates = {
        str((datetime.fromisoformat(period[0]) + timedelta(days=n)).date())
        for n in range(
            (datetime.fromisoformat(period[1]) - datetime.fromisoformat(period[0])).days
            + 1
        )
    }
    for pid in {o["identity"]["pra"] for o in outputs}:
        days = [
            r["valid_date"]
            for o in outputs
            if o["identity"]["pra"] == pid
            for r in o["daily"]
        ]
        if len(days) != len(set(days)) or set(days) != expected_dates:
            raise ValueError("Missing or duplicate PRA date across windows")
    if len(rows) != len(selected) * len(expected_dates):
        raise ValueError("Incomplete native support")
    report = {
        "tile_inputs_sha256": hashlib.sha256(
            json.dumps(
                [
                    (p.name, hashlib.sha256(p.read_bytes()).hexdigest())
                    for p in sorted((a.root / "tiles").glob("*.json.gz"))
                ],
                sort_keys=True,
                allow_nan=False,
            ).encode()
        ).hexdigest(),
        "dataset_identity": dataset_identity,
        "pra_batches": len(outputs),
        "pra_count": len({o["identity"]["pra"] for o in outputs}),
        "windows": [list(p) for p in ordered],
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
