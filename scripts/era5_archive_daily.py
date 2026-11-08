"""Incremental DEV ERA5 immutable archive writer; never persists database rows."""

import argparse
import gzip
import hashlib
import json
import resource
import signal
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from time import monotonic
from typing import Any

from agriclimax.climate.era5_land import Era5LandProvider, cds_retrieve
from agriclimax.climate.models import Dataset, ReferencePeriod
from agriclimax.ingestion.storage import atomic_write
from agriclimax.territories.national_daily import DATASET, REFERENCE, acquire_windows
from agriclimax.territories.pipeline import run_batch
from agriclimax.territories.repository import PraRepository
from agriclimax.territories.spatial import Weight, load_reference
from data01_daily import next_day
from era5_coastal_complement import incremental_day
from era5_spatial_restitution import NATIVE_VARIABLES
from era5_spatial_restitution import build as build_support
from pra_lossless_archive import pack, restore
from pra_weather_store import ArchiveStore


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--date", type=date.fromisoformat)
    p.add_argument("--root", type=Path, default=Path("work/era5-archive"))
    p.add_argument("--max-downloads", type=int, default=64)
    p.add_argument("--replay-latest", action="store_true")
    p.add_argument("--resume", action="store_true", help="Continue exactly the day in the restored run receipt")
    p.add_argument("--execute", action="store_true")
    p.add_argument("--publish-dev", action="store_true")
    args = p.parse_args()
    if not args.execute:
        print(json.dumps({"plan_only": True, "database_writes": 0}))
        return
    if not 1 <= args.max_downloads <= 64:
        raise ValueError("One to 64 shared source extents required")
    resource.setrlimit(resource.RLIMIT_AS, (4 * 1024**3, 4 * 1024**3))
    started = monotonic()
    store = ArchiveStore(read_only=not args.publish_dev)
    catalogue = store.catalogue()
    repository = PraRepository(REFERENCE, DATASET)
    anchor = date.fromisoformat(repository.catalog()["latest"])
    latest = max([anchor, *(date.fromisoformat(d) for e in catalogue["era5"] for d in e["dates"])])
    checkpoint = args.root / "report.json"
    resume_day = date.fromisoformat(json.loads(checkpoint.read_text())["date"]) if args.resume and checkpoint.exists() else None
    if args.resume and resume_day is None:
        raise ValueError("Continuation requires an existing day receipt")
    if args.date and resume_day and args.date != resume_day:
        raise ValueError("Explicit date conflicts with checkpoint day")
    planned, planning_status = next_day(
        {date.fromisoformat(d) for e in catalogue["era5"] for d in e["dates"]},
        anchor, datetime.now(UTC).date(),
    )
    day = args.date or resume_day or (latest if args.replay_latest else planned)
    if day is None:
        args.root.mkdir(parents=True, exist_ok=True)
        atomic_write(args.root / "report.json", json.dumps({"status": planning_status,
                     "database_writes": 0, "storage_writes": 0, "source_requests": 0}).encode())
        return
    args.root.mkdir(parents=True, exist_ok=True)
    report: dict[str, Any] = {"date": str(day), "database_writes": 0, "source_requests": 0, "source_bytes": 0, "storage_writes": 0}
    atomic_write(args.root / "report.json", json.dumps(report, indent=2).encode())
    entry = next((e for e in catalogue["era5"] if str(day) in e["dates"]), None)
    if entry:
        raw = store.blob(entry["path"], entry["sha256"])
        restored = json.loads(gzip.decompress(raw))
        selected: list[dict[str, Any]] = []
        for record in restored["records"]:
            if hashlib.sha256(record["content"].encode()).hexdigest() != record["sha256"]:
                raise ValueError("Replay envelope checksum mismatch")
            selected.extend(r for r in json.loads(record["content"])["daily"] if r["valid_date"] == str(day))
        if len(selected) != 713 or len({r["pra_id"] for r in selected}) != 713:
            raise ValueError("Replay national day restoration incomplete")
        report["restored_rows"] = len(selected)
        report["archive_sha256"] = entry["sha256"]
        report["status"] = "read_only_existing_archive"
        if args.publish_dev:
            # Explicit DEV repair after interruption between catalogue and pointer.
            store.publish_current(catalogue)
            report["storage_writes"] = store.writes
            report["status"] = "verified_current_repaired_dev"
        atomic_write(args.root / "report.json", json.dumps(report, indent=2).encode())
        print(json.dumps(report))
        return
    if day <= anchor:
        raise ValueError("Do not reacquire existing legacy national history")
    if day > datetime.now(UTC).date() - timedelta(days=6):
        report["status"] = "not_yet_available_by_conservative_publication_ceiling"
        atomic_write(args.root / "report.json", json.dumps(report, indent=2).encode())
        print(json.dumps(report))
        return
    root = args.root / str(day)
    root.mkdir(exist_ok=True)
    directory = Path("config/coverage") / REFERENCE
    territories, _ = load_reference(json.loads((directory / "reference.json").read_text()), version=REFERENCE)
    weights = [Weight(**w) for w in json.loads((directory / "weights.json").read_text())]
    if len({t.id for t in territories}) != 713:
        raise ValueError("Exactly 713 unchanged PRA required")

    def retrieve(request: dict[str, object], target: Path) -> None:
        remaining = int(1260 - (monotonic() - started))
        if report["source_requests"] >= 128 or report["source_bytes"] + 16 * 1024**2 > 128 * 1024**2 or remaining < 10:
            raise TimeoutError("Archive-only source budget exhausted; retain checkpoints")
        report["source_requests"] += 1
        try:
            cds_retrieve(request, target, timeout_seconds=min(240, remaining), max_file_bytes=16 * 1024**2)
        finally:
            report["source_bytes"] += target.stat().st_size if target.exists() else 0

    def terminate(signum: int, frame: object) -> None:
        raise RuntimeError("Archive-only run interrupted; prior catalogue preserved")

    signal.signal(signal.SIGTERM, terminate)
    signal.signal(signal.SIGALRM, terminate)
    signal.alarm(1260)
    try:
        phase_started = monotonic()
        report["stage"] = "acquisition"
        provider = Era5LandProvider(Dataset(dataset_version=DATASET, reference_period=ReferencePeriod(start_year=1991, end_year=2020, minimum_years=24)), root / "source-cache", retrieve=retrieve, require_complete_time_axis=True)
        ready, acquired, created = acquire_windows(provider, {day: weights}, root, args.max_downloads)
        report.update({"source_groups": acquired, "new_compact_tiles": created, "status": "processing"})
        report["acquisition_seconds"] = monotonic() - phase_started
        atomic_write(args.root / "report.json", json.dumps(report, indent=2).encode())
        if not ready:
            raise TimeoutError("Source group budget reached; continue from checkpoints")
        if ready:
            phase_started = monotonic()
            report["stage"] = "aggregation"
            used = sum(p.stat().st_size for p in root.rglob("*") if p.is_file())
            for territory in territories:
                if monotonic() - started >= 1260:
                    raise TimeoutError("Aggregation checkpoint budget exhausted")
                batch = run_batch(provider, territory, weights, day, day, root, max_downloads=0, workspace_bytes=used)
                if batch["status"] != "replayed":
                    directory = root / "batches" / batch["batch_key"]
                    # Existing partial outputs are overcounted deliberately, never undercounted.
                    used += sum(p.stat().st_size for p in directory.iterdir() if p.is_file())
                report["completed_batches"] = report.get("completed_batches", 0) + 1
            report["aggregation_seconds"] = monotonic() - phase_started
            report["stage"] = "independent_restoration"
            archive = root / "exact.json.gz"
            receipt = pack(root, archive)
            restored = restore(archive, root / "verified-restore")
            rows = []
            for output in (root / "verified-restore/batches").glob("*/output.json"):
                rows.extend(json.loads(output.read_text())["daily"])
            if restored != 713 or len(rows) != 713 or {r["pra_id"] for r in rows} != {t.id for t in territories} or any(r["valid_date"] != str(day) for r in rows):
                raise ValueError("Full independent restoration failed before publication")
            report.update({"status": "verified", "restored_rows": len(rows), "archive": receipt, "sha256": hashlib.sha256(archive.read_bytes()).hexdigest()})
            if args.publish_dev:
                report["stage"] = "publication"
                support_path = root / "support.json"
                report["spatial_support"] = build_support(root, support_path, variables=NATIVE_VARIABLES)
                support_document = json.loads(support_path.read_bytes())
                complement = incremental_day(root, str(day))
                if complement:
                    support_document["complementary"] = complement
                geometry_document = {"rule_version": support_document["rule_version"], "reference_sha256": support_document["reference_sha256"], "geometries": support_document.pop("geometries")}
                raw_geometry = gzip.compress(json.dumps(geometry_document, sort_keys=True, separators=(",", ":")).encode(), mtime=0)
                geometry_sha = hashlib.sha256(raw_geometry).hexdigest()
                geometry_entry: dict[str, Any] = {"path": f"support/{geometry_sha}.json.gz", "sha256": geometry_sha, "bytes": len(raw_geometry), "dates": []}
                store.put_immutable(geometry_entry["path"], raw_geometry)
                support_document["geometry_entry"] = geometry_entry
                raw_support = gzip.compress(json.dumps(support_document, sort_keys=True, separators=(",", ":")).encode(), mtime=0)
                support_sha = hashlib.sha256(raw_support).hexdigest()
                support_entry: dict[str, Any] = {"path": f"support/{support_sha}.json.gz", "sha256": support_sha, "bytes": len(raw_support), "dates": [str(day)], "method_version": "pra-observed-area-mean-90-1", "geometry_entry": geometry_entry}
                store.put_immutable(support_entry["path"], raw_support)
                report["publication"] = store.publish_era5(archive, [str(day)], support_entry)
                report["storage_writes"] = store.writes
                report["status"] = "published"
    except Exception as error:
        report["status"] = "failed_previous_publication_preserved"
        report["error_type"] = type(error).__name__
        raise
    finally:
        signal.alarm(0)
        report["seconds"] = monotonic() - started
        atomic_write(args.root / "report.json", json.dumps(report, indent=2).encode())
    print(json.dumps(report))


if __name__ == "__main__":
    main()
