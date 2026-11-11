"""Bounded acquisition samples, with native dates checked; never national coverage or publication."""

import argparse
import json
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from agriclimax.ingestion.meteofrance import (
    MVP_STATIONS,
    MeteoFranceAccessError,
    MeteoFranceProvider,
    MeteoFranceTransportError,
)
from agriclimax.ingestion.station_auth import Product
from national_weather_sources import (
    PARAMETERS,
    Budget,
    WcsAcquisitionError,
    WcsProvider,
    grib_metadata,
)
from probe_operational_access import field_parameters


def station_window(root: Path) -> dict[str, object]:
    """Exercise the actual daily pipeline with local sinks, no persistence credentials."""
    from agriclimax.daily import run_daily
    from agriclimax.ingestion.models import DayBatch
    from agriclimax.wheat.models import Parameters

    class LocalSink:
        def persist(self, batch: DayBatch) -> bool:
            return False

    now = datetime.now(UTC)
    end, start = now.date() - timedelta(days=1), now.date() - timedelta(days=7)
    provider = MeteoFranceProvider(MVP_STATIONS, start, end)
    directory = root / "station-window"
    success = run_daily(provider, LocalSink(), lambda _: False, start=start, end=end, now=now,
                        root=directory, parameters=Parameters.model_validate_json(Path("config/wheat-mvp.json").read_bytes()),
                        cattle_rule=Path("config/cattle/thi-v1.json"))
    report = json.loads((directory / "logs/run.json").read_text())
    return {"product": "climatology-window", "status": "local_pipeline_passed" if success else "local_pipeline_failed",
            "scope": "seven_days_five_stations_local_sinks", "database_writes": 0, "remote_publications": 0,
            "from": str(start), "to": str(end),
            "diagnostic": {k: report[k] for k in ("stage", "substage", "date", "reason", "error_type", "http_status",
                           "rejected_station_days", "accepted_stations", "received_rows") if k in report}}


def station_sample(product: Product) -> dict[str, object]:
    day = datetime.now(UTC).date() - timedelta(days=1 if product == "climatology" else 0)
    # One station only, one archive day/order or one instantaneous sample.
    provider = MeteoFranceProvider((MVP_STATIONS[0],), day, day, product=product)
    payload = json.loads(provider.download(day).content)
    rows = payload["rows"]
    return {"product": product, "status": "sample_received" if rows and any(r["value"] is not None for r in rows) else "data_absent",
            "requested_date": str(day), "station": MVP_STATIONS[0], "rows": len(rows),
            "actual_times": sorted({r["observed_at"] for r in rows}),
            "variables_with_value": sorted({r["variable"] for r in rows if r["value"] is not None}),
            "quality_flags": sorted({f for r in rows for f in r["quality_flags"]}),
            "national_coverage_verified": False}


def verify_field(meta: dict[str, Any], run: datetime, valid_at: datetime, product: str) -> None:
    original = datetime.strptime(f"{meta['dataDate']}{int(meta['dataTime']):04d}", "%Y%m%d%H%M").replace(tzinfo=UTC)
    valid = datetime.strptime(f"{meta['validityDate']}{int(meta['validityTime']):04d}", "%Y%m%d%H%M").replace(tzinfo=UTC)
    spacing = 0.025 if product == "arome" else 0.1
    if (original != run or valid != valid_at or meta["units"] != "K" or meta["level"] != 2
            or meta["shortName"] != "2t" or meta["typeOfLevel"] != "heightAboveGround"
            or meta["typeOfGeneratingProcess"] != 2 or meta["stepUnits"] != 1
            or meta["endStep"] != int((valid_at - run).total_seconds() / 3600)
            or abs(float(meta["iDirectionIncrementInDegrees"]) - spacing) > 1e-8
            or abs(float(meta["jDirectionIncrementInDegrees"]) - spacing) > 1e-8):
        raise ValueError("Native run/validity/variable/grid mismatch")


def model_sample(product: str, root: Path) -> dict[str, object]:
    budget = Budget(seconds_limit=100, requests_limit=10, bytes_limit=32 * 1024**2)
    provider = WcsProvider(product, root, budget)
    prefix = PARAMETERS["temperature"] + "___"
    ids = [value for value in provider.catalogue() if value.startswith(prefix)]
    coverage = max(ids)
    run = datetime.strptime(coverage.removeprefix(prefix), "%Y-%m-%dT%H.%M.%SZ").replace(tzinfo=UTC)
    now = datetime.now(UTC)
    if not timedelta(0) <= now - run <= timedelta(hours=24):
        raise ValueError("No recent advertised model run")
    description = provider.description(coverage)
    _, selected = field_parameters(description)
    valid_at = datetime.fromisoformat(str(next(v for k, v in selected.items() if k.lower() == "time")))
    raw = provider.field(coverage, valid_at, (1.4, 48.0, 1.5, 48.1), 256 * 1024)
    meta, values = grib_metadata(raw)
    verify_field(meta, run, valid_at, product)
    return {"product": product, "status": "native_sample_verified", "run": run.isoformat(),
            "valid_at": valid_at.isoformat(), "acquired_at": provider.latest["acquired_at"],
            "field_sha256": provider.latest["sha256"], "points": len(values), "grib": meta,
            "source_requests": budget.requests, "source_bytes": budget.bytes,
            "national_coverage_verified": False, "horizon_5_7_days_verified": False}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("work/meteofrance-sample"))
    parser.add_argument("--station-window", action="store_true", help="Also qualify the seven-day MVP pipeline using local sinks only")
    args = parser.parse_args()
    results = []
    for product in ("climatology", "observations", "arome", "arpege"):
        try:
            if product == "climatology":
                result = station_sample("climatology")
            elif product == "observations":
                result = station_sample("observations")
            else:
                result = model_sample(product, args.root)
        except MeteoFranceAccessError as error:
            result = {"product": product, "status": error.reason, "http_status": error.http_status}
        except MeteoFranceTransportError as error:
            result = {"product": product, "status": "http_error", "http_status": error.http_status}
        except WcsAcquisitionError as error:
            result = {"product": product, "status": error.reason, "http_status": error.http_status,
                      "operation": error.operation}
        except Exception as error:  # noqa: BLE001 - no arbitrary exception text or source response
            result = {"product": product, "status": "sample_failed", "error_type": type(error).__name__}
        results.append(result)
    if args.station_window:
        results.append(station_window(args.root))
    report = {"observed_at": datetime.now(UTC).isoformat(), "database_writes": 0, "openai_calls": 0,
              "scope": "one_station_and_one_temperature_field_per_model", "results": results}
    args.root.mkdir(parents=True, exist_ok=True)
    (args.root / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with Path(os.environ["GITHUB_STEP_SUMMARY"]).open("a") as stream:
            stream.write("\n## Échantillons acquis sans publication\n\n```json\n" + json.dumps(report, indent=2) + "\n```\n")
    print(json.dumps(report))
    return 0 if all(r["status"] in {"sample_received", "native_sample_verified", "local_pipeline_passed"} for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
