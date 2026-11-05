"""Manual, bounded IFS pilot: selected GRIB byte ranges, never a full GRIB file."""

import argparse
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
    GRID,
    PILOT_CODES,
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
    args = parser.parse_args()
    if not 0 <= (datetime.now(UTC).date() - args.run_date).days <= 3:
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
            if path.exists():
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
            receipt = {
                "step": step,
                "param": param,
                "offset": offset,
                "length": length,
                "sha256": sha.read_text(),
            }
            receipts.append(receipt)
            fields[step, param] = read_grib(
                str(path),
                step,
                {"2t": "2t", "2d": "2d", "tp": "tp"}[param],
                cells,
                int(args.run_date.strftime("%Y%m%d")),
            )
    run = datetime.combine(args.run_date, datetime.min.time(), UTC)
    acquired = datetime.now(UTC)
    provenance = digest({"origin": source_url, "receipts": receipts})
    rows = []
    for day_offset in range(1, 8):
        start, end = 24 * day_offset, 24 * (day_offset + 1)
        selected = [s for s in steps if start <= s <= end]
        if selected[0] != start or selected[-1] != end:
            raise ValueError("Incomplete daily temporal support")
        native: dict[Variable, dict[str, float | None]] = {v: {} for v in VARIABLES}
        for cell in cells:
            ts = [fields[s, "2t"][cell] for s in selected]
            ds = [fields[s, "2d"][cell] for s in selected]
            rain0, rain1 = fields[start, "tp"][cell], fields[end, "tp"][cell]
            full = all(x is not None for x in ts)
            if full:
                temps = [float(x) for x in ts if x is not None]
                native["temperature"][cell] = (
                    sum(
                        (temps[i] + temps[i + 1]) / 2 * (selected[i + 1] - selected[i])
                        for i in range(len(selected) - 1)
                    )
                    / 24
                    - 273.15
                )
                native["temperature_min"][cell] = min(temps) - 273.15
                native["temperature_max"][cell] = max(temps) - 273.15
            else:
                for v in ("temperature", "temperature_min", "temperature_max"):
                    native[v][cell] = None
            rain = None if rain0 is None or rain1 is None else (rain1 - rain0) * 1000
            if rain is not None and rain < 0:
                raise ValueError("Negative accumulated rainfall difference")
            native["precipitation"][cell] = rain
            hs = [
                humidity(float(t), float(d))
                for t, d in zip(ts, ds, strict=True)
                if t is not None and d is not None
            ]
            native["humidity"][cell] = (
                None
                if len(hs) != len(selected)
                else sum(
                    (hs[i] + hs[i + 1]) / 2 * (selected[i + 1] - selected[i])
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
                    "coastal_grid_footprint_contains_sea",
                    "sampled_3h_then_6h_not_hourly",
                )
                if variable in {"temperature_min", "temperature_max"}:
                    flags += ("sampled_extrema_not_continuous_daily_extrema",)
                if variable == "humidity":
                    flags += ("magnus_water_surface_approximation",)
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
                        rule_version="pra-weather-1",
                        grid_version=GRID,
                        weights_sha256=weight_fingerprint(ws),
                        spatial_coverage=min(1, result.valid_weighted_coverage),
                        temporal_coverage=1,
                        quality_flags=flags,
                        provenance_sha256=provenance,
                        acquired_at=acquired,
                        published_at=None,
                        unavailable_reason=None
                        if result.status != "unavailable"
                        else "native_support_missing",
                        delayed=False,
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
        "provenance_sha256": provenance,
        "weights": [asdict(w) for w in weights],
        "metrics": {
            "network_requests": calls,
            "downloaded_bytes": transferred,
            "seconds": time.monotonic() - started,
            "max_rss_kib": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        },
    }
    atomic_write(
        args.root / "cycle.json",
        json.dumps(report, sort_keys=True, allow_nan=False).encode(),
    )
    print(json.dumps(report["metrics"]))


if __name__ == "__main__":
    main()
