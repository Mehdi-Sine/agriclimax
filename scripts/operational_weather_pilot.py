"""Manual, bounded IFS pilot: selected GRIB byte ranges, never a full GRIB file."""

import argparse
import gzip
import hashlib
import json
import resource
import time
from dataclasses import asdict
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Literal

VARIABLES: tuple["Variable", ...] = (
    "temperature",
    "temperature_min",
    "temperature_max",
    "precipitation",
    "humidity",
)

Variable = Literal[
    "temperature", "temperature_min", "temperature_max", "precipitation", "humidity"
]
from urllib.request import Request, urlopen

from agriclimax.ingestion.storage import atomic_write
from agriclimax.territories.aggregate import Family, aggregate
from agriclimax.territories.national_daily import REFERENCE
from agriclimax.territories.operational import (
    CALCULATION_VERSION,
    GRID,
    PILOT_CODES,
    daily_temperature,
    grid_weights,
    humidity,
    read_grib,
    weight_fingerprint,
)
from agriclimax.territories.pipeline import digest
from agriclimax.territories.spatial import load_reference
from agriclimax.territories.weather import PraWeather


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-date", type=date.fromisoformat, required=True)
    parser.add_argument("--root", type=Path, default=Path("work/operational-pilot"))
    parser.add_argument("--execute", action="store_true")
    parser.add_argument(
        "--offline-native",
        action="store_true",
        help="Recompute verified compact native inputs; networking forbidden",
    )
    args = parser.parse_args()
    if args.run_date > datetime.now(UTC).date() or (
        not args.offline_native and (datetime.now(UTC).date() - args.run_date).days > 3
    ):
        raise ValueError("Only retained recent 00 UTC cycles, at most three days old")
    steps = list(range(0, 145, 3)) + list(range(150, 193, 6))
    params = ("2t", "2d", "tp")
    if not args.execute:
        print(
            json.dumps(
                {
                    "run": str(args.run_date),
                    "steps": steps,
                    "parameters": params,
                    "pra": PILOT_CODES,
                    "request_limit": 240,
                    "source_bytes_limit": 96 * 1024**2,
                    "seconds_limit": 1200,
                }
            )
        )
        return
    resource.setrlimit(resource.RLIMIT_AS, (4 * 1024**3, 4 * 1024**3))
    started = time.monotonic()
    calls = 0
    transferred = 0
    args.root.mkdir(parents=True, exist_ok=True)
    reference = json.loads(
        (Path("config/coverage") / REFERENCE / "reference.json").read_text()
    )
    reference["features"] = [
        f for f in reference["features"] if f["properties"]["code"] in PILOT_CODES
    ]
    territories, _ = load_reference(reference, version=REFERENCE)
    if {t.code for t in territories} != set(PILOT_CODES):
        raise ValueError("Official pilot identity mismatch")
    weights = grid_weights(territories)
    cells = {w.cell_id for w in weights}
    source_url = f"https://data.ecmwf.int/forecasts/{args.run_date:%Y%m%d}/00z/ifs/0p25/oper/{args.run_date:%Y%m%d}000000"
    receipts = []
    fields = {}
    native_cache = args.root / "native.json.gz"
    native_fields = {}
    if native_cache.exists():
        raw = native_cache.read_bytes()
        if (
            hashlib.sha256(raw).hexdigest()
            != native_cache.with_suffix(".sha256").read_text()
        ):
            raise ValueError("Corrupt native pilot cache")
        saved = json.loads(gzip.decompress(raw))
        if saved["run_date"] != str(args.run_date) or saved["grid_version"] != GRID:
            raise ValueError("Wrong native pilot run/grid")
        native_fields = saved["fields"]
    original_times = (
        json.loads((args.root / "original-acquisition-times.json").read_text())
        if (args.root / "original-acquisition-times.json").exists()
        else {}
    )
    acquisition_times = []
    decode_seconds = 0.0

    def fetch(url: str, limit: int, headers: dict[str, str] | None = None) -> bytes:
        nonlocal calls, transferred
        if (
            calls >= 240
            or transferred + limit > 96 * 1024**2
            or time.monotonic() - started > 1200
        ):
            raise ValueError("Bounded pilot resource budget exhausted")
        calls += 1
        with urlopen(Request(url, headers=headers or {}), timeout=30) as response:
            if headers and (
                response.status != 206
                or response.headers.get("Content-Range", "").split("/")[0]
                != "bytes " + headers["Range"][6:]
            ):
                raise ValueError(
                    "Server did not honor exact range; full download refused"
                )
            raw = response.read(limit + 1)
        transferred += len(raw)
        if len(raw) > limit:
            raise ValueError("Source byte budget exceeded")
        return bytes(raw)

    if args.offline_native:
        if not native_fields:
            raise ValueError("Verified native cache required for offline reproduction")
        manifest = json.loads((args.root / "native-manifest.json").read_text())
        if manifest["source_url"] != source_url or manifest["run_date"] != str(
            args.run_date
        ):
            raise ValueError("Wrong offline source cycle")
        receipts = manifest["receipts"]
        acquisition_times = [datetime.fromisoformat(manifest["acquired_at"])]
        original_times = (
            {"precision": "runner_archive_mtime_2_seconds"}
            if manifest["archive_time_precision"]
            else {}
        )
        required_keys = {
            f"{s}:{p}" for s in steps for p in params if (s, p) != (0, "tp")
        }
        if set(native_fields) != required_keys:
            raise ValueError("Incomplete native temporal/variable support")
        for key, values in native_fields.items():
            if set(values) != cells:
                raise ValueError("Wrong native spatial support")
            step_text, param = key.split(":")
            fields[int(step_text), param] = values
    else:
        for step in steps:
            index_path = args.root / f"{step}.index"
            if index_path.exists():
                raw = index_path.read_bytes()
            else:
                raw = fetch(f"{source_url}-{step}h-oper-fc.index", 256 * 1024)
                atomic_write(index_path, raw)
            index = [json.loads(line) for line in raw.splitlines()]
            for param in params:
                if param == "tp" and step == 0:
                    continue
                matches = [
                    r
                    for r in index
                    if r.get("param") == param
                    and r.get("levtype") == "sfc"
                    and int(r["step"]) == step
                    and r["date"] == args.run_date.strftime("%Y%m%d")
                    and r["time"] == "0000"
                ]
                if len(matches) != 1:
                    raise ValueError("Selected index field absent/ambiguous")
                entry = matches[0]
                offset = int(entry["_offset"])
                length = int(entry["_length"])
                if not 1 <= length <= 3 * 1024**2 or offset < 0:
                    raise ValueError("Field range invalid")
                path = args.root / f"{step}-{param}.grib2"
                sha = path.with_suffix(".sha256")
                cached_source = path.exists()
                if cached_source:
                    content = path.read_bytes()
                    if (
                        not sha.exists()
                        or hashlib.sha256(content).hexdigest() != sha.read_text()
                    ):
                        raise ValueError("Corrupt pilot cache")
                else:
                    content = fetch(
                        f"{source_url}-{step}h-oper-fc.grib2",
                        length,
                        {"Range": f"bytes={offset}-{offset + length - 1}"},
                    )
                    if len(content) != length:
                        raise ValueError("Truncated range")
                    atomic_write(path, content)
                    atomic_write(sha, hashlib.sha256(content).hexdigest().encode())
                receipt_path = path.with_suffix(".receipt.json")
                if receipt_path.exists():
                    acquired_stamp = json.loads(receipt_path.read_text())[
                        "retrieved_at"
                    ]
                elif path.name in original_times:
                    acquired_stamp = original_times[path.name]
                    atomic_write(
                        receipt_path,
                        json.dumps(
                            {
                                "retrieved_at": acquired_stamp,
                                "precision": "runner_archive_mtime_2_seconds",
                            }
                        ).encode(),
                    )
                elif cached_source:
                    raise ValueError(
                        "Cached source acquisition time unknown; original receipt required"
                    )
                else:
                    acquired_stamp = datetime.now(UTC).isoformat()
                    atomic_write(
                        receipt_path,
                        json.dumps(
                            {
                                "retrieved_at": acquired_stamp,
                                "precision": "retrieval_completion",
                            }
                        ).encode(),
                    )
                acquisition_times.append(datetime.fromisoformat(acquired_stamp))
                receipt = {
                    "step": step,
                    "param": param,
                    "offset": offset,
                    "length": length,
                    "sha256": sha.read_text(),
                }
                receipts.append(receipt)
                native_key = f"{step}:{param}"
                if native_fields:
                    if set(native_fields[native_key]) != cells:
                        raise ValueError("Native pilot support mismatch")
                    fields[step, param] = native_fields[native_key]
                else:
                    before_decode = time.monotonic()
                    fields[step, param] = read_grib(
                        str(path),
                        step,
                        param,
                        cells,
                        int(args.run_date.strftime("%Y%m%d")),
                    )
                    decode_seconds += time.monotonic() - before_decode
    provenance = digest({"origin": source_url, "receipts": receipts})
    if native_fields:
        if saved["provenance_sha256"] != provenance:
            raise ValueError("Native pilot provenance mismatch")
    else:
        content = gzip.compress(
            json.dumps(
                {
                    "run_date": str(args.run_date),
                    "grid_version": GRID,
                    "provenance_sha256": provenance,
                    "fields": {
                        f"{step}:{param}": values
                        for (step, param), values in fields.items()
                    },
                },
                sort_keys=True,
                allow_nan=False,
            ).encode(),
            mtime=0,
        )
        atomic_write(native_cache, content)
        atomic_write(
            native_cache.with_suffix(".sha256"),
            hashlib.sha256(content).hexdigest().encode(),
        )
    run = datetime.combine(args.run_date, datetime.min.time(), UTC)
    acquired = max(acquisition_times)
    provenance = digest({"origin": source_url, "receipts": receipts})
    rows = []
    negative_rain: list[dict[str, object]] = []
    invalid_rh: list[dict[str, object]] = []
    for day_offset in range(1, 8):
        start, end = 24 * day_offset, 24 * (day_offset + 1)
        selected = [s for s in steps if start <= s <= end]
        if selected[0] != start or selected[-1] != end:
            raise ValueError("Incomplete daily temporal support")
        native: dict[Variable, dict[str, float | None]] = {v: {} for v in VARIABLES}
        invalid_rain = set()
        invalid_humidity = set()
        temporal: dict[Variable, dict[str, float]] = {v: {} for v in VARIABLES}
        for cell in cells:
            ts = [fields[s, "2t"][cell] for s in selected]
            ds = [fields[s, "2d"][cell] for s in selected]
            rain0, rain1 = fields[start, "tp"][cell], fields[end, "tp"][cell]
            mean, minimum, maximum = daily_temperature(ts, selected)
            native["temperature"][cell] = mean
            native["temperature_min"][cell] = minimum
            native["temperature_max"][cell] = maximum
            rain = None if rain0 is None or rain1 is None else (rain1 - rain0) * 1000
            if rain is not None and rain < 0:
                negative_rain.append(
                    {"cell_id": cell, "day_offset": day_offset, "difference_mm": rain}
                )
                invalid_rain.add(cell)
                rain = None
            native["precipitation"][cell] = rain
            temperature_coverage = (
                sum(
                    selected[i + 1] - selected[i]
                    for i in range(len(selected) - 1)
                    if ts[i] is not None and ts[i + 1] is not None
                )
                / 24
            )
            for v in VARIABLES:
                if v.startswith("temperature"):
                    temporal[v][cell] = temperature_coverage
            temporal["precipitation"][cell] = 0.0 if rain is None else 1.0
            hs: list[float | None] = []
            for step, tvalue, dvalue in zip(selected, ts, ds, strict=True):
                if tvalue is None or dvalue is None:
                    hs.append(None)
                else:
                    try:
                        hs.append(humidity(tvalue, dvalue))
                    except ValueError:
                        hs.append(None)
                        invalid_humidity.add(cell)
                        invalid_rh.append(
                            {
                                "cell_id": cell,
                                "step": step,
                                "temperature_k": tvalue,
                                "dewpoint_k": dvalue,
                            }
                        )
            temporal["humidity"][cell] = (
                sum(
                    selected[i + 1] - selected[i]
                    for i in range(len(selected) - 1)
                    if hs[i] is not None and hs[i + 1] is not None
                )
                / 24
            )
            valid_hs = [h for h in hs if h is not None]
            native["humidity"][cell] = (
                None
                if len(valid_hs) != len(selected)
                else sum(
                    (valid_hs[i] + valid_hs[i + 1])
                    / 2
                    * (selected[i + 1] - selected[i])
                    for i in range(len(selected) - 1)
                )
                / 24
            )
        for t in territories:
            ws = [w for w in weights if w.pra_id == t.id]
            for variable, values in native.items():
                family: Family = (
                    "spatial_min"
                    if variable == "temperature_min"
                    else "spatial_max"
                    if variable == "temperature_max"
                    else "spatial_mean"
                )
                result = aggregate(ws, values, family)
                flags = (
                    *result.quality_flags,
                    "model_forecast_not_observation",
                    "source_grid_not_land_masked",
                    "utc_half_open_day_extrema",
                    "sampled_3h_then_6h_not_hourly",
                    "publication_time_unknown",
                    "source_delay_not_assessed",
                )
                if variable in {"temperature_min", "temperature_max"}:
                    flags += ("sampled_extrema_not_continuous_daily_extrema",)
                if variable == "precipitation" and any(
                    w.cell_id in invalid_rain for w in ws
                ):
                    flags += ("nonmonotonic_source_accumulation_invalid_null",)
                if variable == "humidity":
                    flags += ("magnus_water_surface_approximation",)
                    if any(w.cell_id in invalid_humidity for w in ws):
                        flags += ("invalid_derived_humidity_null_not_clamped",)
                if original_times:
                    flags += (
                        "acquisition_time_from_runner_artifact_mtime_2_second_precision",
                    )
                rows.append(
                    PraWeather(
                        pra_id=t.id,
                        variable=variable,
                        unit="mm"
                        if variable == "precipitation"
                        else "%"
                        if variable == "humidity"
                        else "degC",
                        value=result.value,
                        status=result.status,
                        valid_date=(run + timedelta(hours=start)).date(),
                        valid_from=run + timedelta(hours=start),
                        valid_to=run + timedelta(hours=end),
                        source_id="ecmwf-open-data",
                        model="ifs-oper-0p25",
                        nature="forecast",
                        model_run_at=run,
                        lead_hours=end,
                        rule_version=CALCULATION_VERSION,
                        grid_version=GRID,
                        weights_sha256=weight_fingerprint(ws),
                        spatial_coverage=min(1, result.valid_weighted_coverage),
                        temporal_coverage=min(
                            temporal[variable][w.cell_id] for w in ws
                        ),
                        quality_flags=flags,
                        provenance_sha256=provenance,
                        acquired_at=acquired,
                        published_at=None,
                        unavailable_reason=None
                        if result.status != "unavailable"
                        else "native_support_missing",
                        delayed=None,
                    ).model_dump(mode="json")
                )
    report = {
        "contract_version": "pra-weather-1",
        "reference_version": REFERENCE,
        "scientific_status": "exploratory",
        "run": run.isoformat(),
        "acquired_at": acquired.isoformat(),
        "source_url": source_url,
        "attribution": "ECMWF IFS Open Data, CC-BY-4.0; exploratory PRA processing AgriclimaX",
        "pra_count": len(territories),
        "rows": rows,
        "recent_estimate_status": "unavailable_no_authenticated_analysis_access",
        "receipts": receipts,
        "native_cache_sha256": native_cache.with_suffix(".sha256").read_text(),
        "quality_audit": {
            "negative_accumulation_cells_days": negative_rain,
            "invalid_humidity_samples": invalid_rh,
        },
        "provenance_sha256": provenance,
        "weights": [asdict(w) for w in weights],
        "metrics": {
            "network_requests": calls,
            "decode_seconds": decode_seconds,
            "native_cache_reused": bool(native_fields),
            "downloaded_bytes": transferred,
            "seconds": time.monotonic() - started,
            "max_rss_kib": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        },
    }
    atomic_write(
        args.root / "native-manifest.json",
        json.dumps(
            {
                "source_url": source_url,
                "run_date": str(args.run_date),
                "acquired_at": acquired.isoformat(),
                "archive_time_precision": bool(original_times),
                "receipts": receipts,
                "provenance_sha256": provenance,
                "native_sha256": native_cache.with_suffix(".sha256").read_text(),
            },
            sort_keys=True,
            allow_nan=False,
        ).encode(),
    )
    atomic_write(
        args.root / "cycle.json",
        json.dumps(report, sort_keys=True, allow_nan=False).encode(),
    )
    print(json.dumps(report["metrics"]))


if __name__ == "__main__":
    main()
