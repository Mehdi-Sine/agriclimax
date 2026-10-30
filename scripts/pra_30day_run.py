"""Task19C: bounded 23-day acquisition, existing <=7-day PRA batches, DEV only."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import os
import resource
import time
from datetime import date
from pathlib import Path
from typing import Any

from agriclimax.climate.coverage import compact
from agriclimax.climate.era5_land import Era5LandProvider, cds_retrieve
from agriclimax.climate.models import Dataset, ReferencePeriod
from agriclimax.ingestion.storage import atomic_write
from agriclimax.territories.pipeline import digest, run_batch
from agriclimax.territories.repository import PraRepository
from agriclimax.territories.spatial import Weight, load_reference

BUNDLE = Path("config/coverage/ofb-masa-pra-2017-snapshot-20261017")
SAMPLE = Path("config/pilots/pra73-v1.json")
ROOT = Path("work/task19c/real")
EDITION = "era5land-pilot73-20260919-20261011-v1"
START, END = date(2026, 9, 19), date(2026, 10, 11)
WINDOWS = [
    (date(2026, 9, 19), date(2026, 9, 25)),
    (date(2026, 9, 26), date(2026, 9, 30)),
    (date(2026, 10, 1), date(2026, 10, 7)),
    (date(2026, 10, 8), date(2026, 10, 11)),
]


def dataset() -> Dataset:
    return Dataset(
        dataset_version=EDITION,
        reference_period=ReferencePeriod(
            start_year=1991, end_year=2020, minimum_years=24
        ),
    )


def tile_path(root: Path, x: int, y: int, start: date, end: date) -> Path:
    return (
        root
        / "tiles"
        / (
            digest(
                {
                    "dataset": dataset().model_dump(mode="json"),
                    "start": str(start),
                    "end": str(end),
                    "west": x,
                    "south": y,
                    "compact_version": 1,
                }
            )
            + ".json.gz"
        )
    )


def verify_tile(path: Path) -> None:
    if (
        hashlib.sha256(path.read_bytes()).hexdigest()
        != path.with_suffix(".sha256").read_text()
    ):
        raise ValueError("Compact tile checksum mismatch")


def verify_proof_inputs(root: Path, proof: dict[str, Any]) -> None:
    """Bind the independent verdict to the immutable bytes actually used for persistence."""
    manifest = [
        (p.name, hashlib.sha256(p.read_bytes()).hexdigest())
        for p in sorted((root / "tiles").glob("*.json.gz"))
    ]
    if digest(manifest) != proof["tile_inputs_sha256"]:
        raise ValueError("Independent proof no longer matches compact inputs")
    for checksum in proof["source_files"]:
        path = root / "source-cache/sources" / (checksum + ".source")
        if hashlib.sha256(path.read_bytes()).hexdigest() != checksum:
            raise ValueError("Verified raw archive changed after validation")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--phase",
        choices=["plan", "acquire", "aggregate", "persist", "replay"],
        default="plan",
    )
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    if (
        args.phase in {"persist", "replay"}
        and os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
        != "https://yyfbpecxvxglzxopsmel.supabase.co"
    ):
        parser.error("Only agriclimax-dev is authorized")
    if args.phase in {"persist", "replay"}:
        proof = json.loads((args.root.parent / "independent.json").read_text())
        composition = json.loads((args.root.parent / "composite.json").read_text())
        verify_proof_inputs(args.root, proof)
        if (
            proof["dataset_identity"] != dataset().model_dump(mode="json")
            or proof["pra_batches"] != 292
            or proof["native_cell_days"] != 41584
            or proof["maximum_source_reduction_error"] > 1e-6
            or proof["maximum_spatial_aggregate_error"] > 1e-6
            or composition["boundary"]["groups"] != 27
            or not composition["boundary"]["exact_including_missing_masks"]
        ):
            raise ValueError("Independent 23-day and composition verification required")
    checksums = json.loads((BUNDLE / "checksums.json").read_text())
    if set(checksums) != {
        "reference.json",
        "weights.json",
        "manifest.json",
        "source-properties.json",
    }:
        raise ValueError("Incomplete reference checksums")
    for name, checksum in checksums.items():
        if hashlib.sha256((BUNDLE / name).read_bytes()).hexdigest() != checksum:
            raise ValueError("Reference checksum mismatch")
    sample = json.loads(SAMPLE.read_text())
    ids = {r["id"] for r in sample["selection"]}
    if len(ids) != 73:
        raise ValueError("Exactly the Task19B selection required")
    territories, _ = load_reference(
        json.loads((BUNDLE / "reference.json").read_text()),
        version=sample["reference_version"],
    )
    territories = [t for t in territories if t.id in ids]
    weights = [
        Weight(**w)
        for w in json.loads((BUNDLE / "weights.json").read_text())
        if w["pra_id"] in ids
    ]
    if len(territories) != 73 or len(weights) != 1892:
        raise ValueError("Pilot reference/count mismatch")
    tiles = {(math.floor(w.longitude), math.floor(w.latitude)) for w in weights}
    groups = sorted({(x // 2 * 2, y // 2 * 2) for x, y in tiles})
    if len(groups) != 27:
        raise ValueError("Pilot source extent changed")
    plan = {
        "dataset": dataset().model_dump(mode="json"),
        "from": str(START),
        "to": str(END),
        "windows": [[str(s), str(e)] for s, e in WINDOWS],
        "new_pra_days": 73 * 23,
        "pra": 73,
        "source_groups": len(groups),
        "expected_cds_requests": 54,
        "max_cds_requests": 60,
        "concurrency": 1,
        "max_cache_bytes": 448 * 1024**2,
        "diagnostics": "not_requested",
        "old_week": "reuse Task19B unchanged",
    }
    root: Path = args.root
    root.mkdir(parents=True, exist_ok=True)
    if (root / "plan.json").exists() and json.loads(
        (root / "plan.json").read_text()
    ) != plan:
        raise ValueError("Immutable execution plan mismatch")
    atomic_write(root / "plan.json", json.dumps(plan, sort_keys=True).encode())
    if args.phase == "plan":
        print(json.dumps(plan, indent=2))
        return
    metrics_path = root / (args.phase + "-metrics.json")
    metrics: dict[str, Any] = {
        "phase": args.phase,
        "requests": [],
        "groups": [],
        "batches": [],
    }
    previous_seconds = 0.0
    if args.phase == "acquire" and metrics_path.exists():
        metrics = json.loads(metrics_path.read_text())
        previous_seconds = metrics["elapsed_seconds"]
        metrics["resumes"] = metrics.get("resumes", 0) + 1
    begin = time.monotonic()

    def save() -> None:
        metrics["elapsed_seconds"] = previous_seconds + time.monotonic() - begin
        metrics["peak_rss_kib"] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        atomic_write(metrics_path, json.dumps(metrics, indent=2).encode())

    def retrieve(request: dict[str, object], target: Path) -> None:
        if len(metrics["requests"]) >= 60:
            raise ValueError("Existing 60-request budget exceeded")
        mark = time.monotonic()
        item: dict[str, Any] = {
            "area": request["area"],
            "month": request["month"],
            "status": "started",
        }
        metrics["requests"].append(item)
        save()
        try:
            cds_retrieve(request, target)
            item.update(status="downloaded", bytes=target.stat().st_size)
        except (RuntimeError, OSError):
            item["status"] = "failed"
            raise
        finally:
            item["seconds"] = time.monotonic() - mark
            save()

    provider = Era5LandProvider(dataset(), root / "source-cache", retrieve=retrieve)
    if args.phase == "acquire":
        for xgroup, ygroup in groups:
            wanted = sorted(
                (x, y)
                for x, y in tiles
                if x // 2 * 2 == xgroup and y // 2 * 2 == ygroup
            )
            paths = [tile_path(root, x, y, s, e) for x, y in wanted for s, e in WINDOWS]
            if all(p.exists() for p in paths):
                for path in paths:
                    verify_tile(path)
                metrics["groups"].append(
                    {"west": xgroup, "south": ygroup, "status": "cache_hit"}
                )
                save()
                continue
            if (
                sum(p.stat().st_size for p in root.rglob("*") if p.is_file())
                > 448 * 1024**2
            ):
                raise ValueError("Existing workspace cache budget exceeded")
            mark = time.monotonic()
            refs = provider.acquire(
                (xgroup, ygroup, xgroup + 2, ygroup + 2), START, END
            )
            # Canonical native 0.1-degree identity, unchanged from Task19B.
            compact_rows = [
                (
                    math.floor(round(r.longitude, 1)),
                    math.floor(round(r.latitude, 1)),
                    compact(r),
                )
                for r in refs
            ]
            for x, y in wanted:
                for s, e in WINDOWS:
                    rows = [
                        row
                        for rx, ry, row in compact_rows
                        if (rx, ry) == (x, y)
                        and str(s) <= str(row["valid_date"]) <= str(e)
                    ]
                    if len(rows) != 100 * ((e - s).days + 1):
                        raise ValueError("Missing native tile/day support")
                    payload = {"rows": rows, "source": refs[0].source_request}
                    content = gzip.compress(
                        json.dumps(payload, sort_keys=True, allow_nan=False).encode(),
                        mtime=0,
                    )
                    path = tile_path(root, x, y, s, e)
                    if path.exists() and path.read_bytes() != content:
                        raise ValueError("Immutable tile conflict")
                    atomic_write(path, content)
                    atomic_write(
                        path.with_suffix(".sha256"),
                        hashlib.sha256(content).hexdigest().encode(),
                    )
            metrics["groups"].append(
                {
                    "west": xgroup,
                    "south": ygroup,
                    "status": "verified",
                    "seconds": time.monotonic() - mark,
                }
            )
            save()
            print("Source group", len(metrics["groups"]), "/", 27, flush=True)
    else:
        repo = (
            PraRepository(sample["reference_version"], EDITION)
            if args.phase in {"persist", "replay"}
            else None
        )
        for s, e in WINDOWS:
            for territory in territories:
                mark = time.monotonic()
                result = run_batch(
                    provider,
                    territory,
                    weights,
                    s,
                    e,
                    root,
                    max_downloads=0,
                    persist=repo.persist if repo else None,
                )
                if result["status"] == "processing":
                    raise ValueError("Source cache incomplete; no implicit download")
                if args.phase == "replay":
                    assert repo is not None
                    repo.persist(
                        json.loads(
                            (
                                root / "batches" / result["batch_key"] / "output.json"
                            ).read_text()
                        )
                    )
                metrics["batches"].append(
                    {
                        "pra": territory.id,
                        "from": str(s),
                        "to": str(e),
                        "seconds": time.monotonic() - mark,
                        **result,
                    }
                )
                save()
            print(
                args.phase,
                str(s),
                str(e),
                len(metrics["batches"]),
                "/",
                292,
                flush=True,
            )
    save()
    print("Completed bounded pilot; no national execution", flush=True)


if __name__ == "__main__":
    main()
