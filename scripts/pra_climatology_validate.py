"""Independent numerical/NULL checks of the complete 73-PRA pilot; no source or DB writes."""

from __future__ import annotations

import argparse
import json
import math
import time

import numpy as np
from agriclimax.climate.pra_normals import VARIABLES, YEARS
from pra_climatology import DAYS, ROOT, checksum, document, requests, source


def same(actual: object, expected: float | None) -> None:
    if expected is None:
        if actual is not None:
            raise ValueError("Invented value with missing input/reference")
    elif not isinstance(actual, (float, int)) or not math.isclose(
        actual, expected, abs_tol=1e-9, rel_tol=1e-12
    ):
        raise ValueError("Independent numeric comparison failed")


def validate(label: str = "pilot") -> dict[str, object]:
    mark = time.monotonic()
    normdoc = json.loads((ROOT / f"{label}-normals.json").read_text())
    anomalies = json.loads((ROOT / f"{label}-anomalies.json").read_text())["data"]
    history = np.load(ROOT / f"{label}-history.npz", allow_pickle=False)
    ids, values = history["ids"].tolist(), history["values"]
    expected_pra = 73 if label == "pilot" else 713
    if (
        len(ids) != expected_pra
        or len(set(ids)) != expected_pra
        or values.shape != (30, 30, expected_pra, 4)
    ):
        raise ValueError("Complete unique pilot 73 ×30 ×30 ×4 required")
    normals = normdoc["data"]
    keys = [(r["pra_id"], r["period_key"], r["variable"]) for r in normals]
    if (
        len(normals) != expected_pra * 31 * 4
        or len(set(keys)) != len(keys)
        or len(anomalies) != len(normals)
    ):
        raise ValueError("Missing/duplicated normal or anomaly rows")
    normal_by_key = dict(zip(keys, normals))
    current = json.loads((ROOT / "current-national.json").read_text())
    current_by_key = {(r["pra_id"], r["valid_date"]): r for r in current}
    if len(current_by_key) != 713 * 30:
        raise ValueError("Incomplete national current export")
    compares = 0
    expected_anomaly_available = 0
    samples: dict[tuple[str, str, str], np.ndarray] = {}
    for pi, pra in enumerate(ids):
        for vi, var in enumerate(VARIABLES):
            for di, day in enumerate(DAYS):
                samples[pra, day.strftime("%m-%d"), var] = values[:, di, pi, vi]
            window = values[:, :, pi, vi]
            # np.sum/mean intentionally propagate NaN; never nanmean incomplete years.
            samples[pra, "09-19/10-18", var] = (
                window.sum(axis=1) if var == "precipitation" else window.mean(axis=1)
            )
    for key, row in normal_by_key.items():
        sample = samples[key]
        complete = bool(np.isfinite(sample).all())
        same(row["sample_years"], float(np.isfinite(sample).sum()))
        expected = float(np.mean(sample)) if complete else None
        same(row["normal"], expected)
        if row["status"] != ("available" if complete else "insufficient"):
            raise ValueError("Incorrect reference availability state")
        for name, p in [("p10", 10), ("median", 50), ("p90", 90)]:
            same(
                row[name],
                float(np.percentile(sample, p, method="linear")) if complete else None,
            )
        compares += 5
    anomaly_keys = set()
    for row in anomalies:
        key = row["pra_id"], row["period_key"], row["variable"]
        if key in anomaly_keys:
            raise ValueError("Duplicated comparison")
        anomaly_keys.add(key)
        sample = samples[key]
        normal = normal_by_key[key]["normal"]
        var = key[2]
        if row["period_days"] == 1:
            actual = current_by_key[key[0], row["date"]][var]
        else:
            series = [current_by_key[key[0], str(day)][var] for day in DAYS]
            actual = (
                (
                    float(np.sum(series))
                    if var == "precipitation"
                    else float(np.mean(series))
                )
                if all(v is not None for v in series)
                else None
            )
        same(row["current_value"], actual)
        same(row["normal_1991_2020"], normal)
        valid = actual is not None and normal is not None
        same(row["anomaly"], actual - normal if valid else None)
        expected_status = (
            "missing_current"
            if actual is None
            else "missing_reference"
            if normal is None
            else "available"
        )
        if row["status"] != expected_status:
            raise ValueError("Incorrect current/reference/anomaly state")
        rank = (
            (
                100
                * (
                    np.count_nonzero(sample < actual)
                    + 0.5 * np.count_nonzero(sample == actual)
                )
                / 30
            )
            if valid
            else None
        )
        same(row["percentile"], rank)
        relative = (
            100 * (actual - normal) / normal
            if valid
            and var == "precipitation"
            and row["period_days"] > 1
            and normal > 0
            else None
        )
        same(row["relative_anomaly_percent"], relative)
        expected_anomaly_available += valid
        compares += 5
    independent = json.loads((ROOT / "source-initial-audit.json").read_text())["rows"]
    for row in independent:
        sample = samples[row["pra_id"], "09-19", row["variable"]]
        same(row["value"], float(sample[0]) if np.isfinite(sample[0]) else None)
        compares += 1
    receipts = []
    for query in requests():
        path = source(query)
        receipt = json.loads(path.with_suffix(".json").read_text())
        if receipt["request"] != query or receipt["sha256"] != checksum(path):
            raise ValueError("Source changed since calculation")
        receipts.append(receipt)
    current_sha = checksum(ROOT / "current-national.json")
    if current_sha != normdoc["provenance"]["current_export_sha256"]:
        raise ValueError("Current export changed")
    timings = []
    for _ in range(10):
        t = time.perf_counter()
        data = json.loads((ROOT / f"{label}-anomalies.json").read_text())
        selected = [r for r in data["data"] if r["pra_id"] == "pra:28341"]
        timings.append((time.perf_counter() - t) * 1000)
        if len(selected) != 124:
            raise ValueError("PRA read incomplete")
    return {
        "status": "passed",
        "pra": expected_pra,
        "daily_slots": expected_pra * 30 * 4,
        "period_slots": expected_pra * 4,
        "reference_years": list(YEARS),
        "scalar_comparisons": compares,
        "normal_rows": len(normals),
        "available_normals": sum(r["normal"] is not None for r in normals),
        "available_anomalies": int(expected_anomaly_available),
        "missing_references": sum(r["normal"] is None for r in normals),
        "sources": len(receipts),
        "source_bytes": sum(r["bytes"] for r in receipts),
        "source_seconds_reported_sum_not_wall_clock": sum(
            r["seconds"] for r in receipts
        ),
        "validation_seconds": time.monotonic() - mark,
        "normal_json_bytes": (ROOT / f"{label}-normals.json").stat().st_size,
        "anomaly_json_bytes": (ROOT / f"{label}-anomalies.json").stat().st_size,
        "history_cache_bytes": (ROOT / f"{label}-history.npz").stat().st_size,
        "local_full_json_parse_and_one_pra_filter_ms": timings,
        "local_read_is_not_postgres_or_http": True,
        "current_export_sha256": current_sha,
        "normal_sha256": checksum(ROOT / f"{label}-normals.json"),
        "anomaly_sha256": checksum(ROOT / f"{label}-anomalies.json"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scope", choices=["pilot", "national"], default="pilot")
    parser.add_argument("--prepare-national", action="store_true")
    args = parser.parse_args()
    result = validate(args.scope)
    document(ROOT / f"{args.scope}-independent.json", result)
    if args.prepare_national:
        if args.scope != "pilot":
            raise ValueError("The national gate comes from the single 73-PRA pilot")
        capacity = json.loads((ROOT / "capacity.json").read_text())[0]
        baseline = json.loads((ROOT / "database-baseline.json").read_text())[0]
        estimate = (
            int(capacity["national_bytes_50pct_margin"])
            + int(baseline["database_bytes_after_capacity_rollback"])
            + 713 * 31 * 4 * float(capacity["bytes_per_row"])
            + 30_000_000
        )
        source_bytes = result["source_bytes"]
        if not isinstance(source_bytes, int):
            raise TypeError("Measured integer source volume required")
        if estimate > 375_000_000 or source_bytes > 2 * 1024**3:
            raise ValueError("National storage envelope exceeded")
        normals = json.loads((ROOT / "pilot-normals.json").read_text())["data"]
        if any(
            not any(r["variable"] == v and r["normal"] is not None for r in normals)
            for v in VARIABLES
        ):
            raise ValueError("No complete reference for a required variable")
        document(
            ROOT / "national-gate.json",
            {
                "decision": "READY_FOR_NATIONAL_CLIMATOLOGY",
                "pilot_proof_sha256": checksum(ROOT / "pilot-independent.json"),
                "normal_sha256": result["normal_sha256"],
                "source_bytes": result["source_bytes"],
                "projected_database_bytes_annual_plus_current_window_and_reserve": estimate,
                "source_hourly_in_postgres": False,
                "thi": False,
            },
        )
    print(json.dumps(result))


if __name__ == "__main__":
    main()
