"""Bounded national DEV execution, including explicitly authorized full reacquisition."""

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
from agriclimax.climate.models import Dataset
from agriclimax.ingestion.storage import atomic_write
from agriclimax.territories.pipeline import digest, run_batch
from agriclimax.territories.repository import PraRepository
from agriclimax.territories.spatial import Weight, load_reference
from pra_30day_review import OLD_EDITION, OLD_ROOT, boundary_equal
from pra_30day_run import BUNDLE, END, START, WINDOWS, dataset, verify_proof_inputs
from pra_30day_run import ROOT as PILOT_ROOT

CONFIG = Path("config/pilots/pra713-30day-prepared-v1.json")
ROOT = Path("work/task19d/real")
NATIONAL_EDITION = "era5land-national-20260919-20261018-v1"
LAST = date(2026, 10, 18)
ALL_WINDOWS = WINDOWS + [(date(2026, 10, 12), LAST)]


def alias_cache(origin: Path, target: Path, original: Dataset, release: Dataset) -> int:
    """Lossless, explicit cache lineage. No HTTP or changed scientific identity."""
    a = original.model_dump(mode="json")
    b = release.model_dump(mode="json")
    if {k: v for k, v in a.items() if k != "dataset_version"} != {
        k: v for k, v in b.items() if k != "dataset_version"
    }:
        raise ValueError("Cannot alias different physical sources")
    paths = sorted((origin / "source-cache/requests").glob("*.json"))
    for path in paths:
        receipt = json.loads(path.read_text())
        request = receipt["request"]
        identity = hashlib.sha256(
            json.dumps({"request": request, "dataset": a}, sort_keys=True).encode()
        ).hexdigest()
        if path.stem != identity:
            raise ValueError("Origin receipt dataset identity mismatch")
        checksum = receipt["checksum"]
        if len(checksum) != 64 or any(c not in "0123456789abcdef" for c in checksum):
            raise ValueError("Invalid source checksum")
        content = (
            origin / "source-cache/sources" / (checksum + ".source")
        ).read_bytes()
        if hashlib.sha256(content).hexdigest() != checksum:
            raise ValueError("Origin archive checksum mismatch")
        new = dict(
            receipt,
            cache_lineage={
                "dataset": a,
                "request_identity": identity,
                "source_sha256": checksum,
            },
        )
        key = hashlib.sha256(
            json.dumps({"request": request, "dataset": b}, sort_keys=True).encode()
        ).hexdigest()
        dest = target / "source-cache/requests" / (key + ".json")
        if dest.exists() and json.loads(dest.read_text()) != new:
            raise ValueError("Immutable cache alias conflict")
        atomic_write(target / "source-cache/sources" / (checksum + ".source"), content)
        atomic_write(dest, json.dumps(new, sort_keys=True).encode())
    return len(paths)


def tile(root: Path, release: Dataset, x: int, y: int, start: date, end: date) -> Path:
    key = digest(
        {
            "dataset": release.model_dump(mode="json"),
            "start": str(start),
            "end": str(end),
            "west": x,
            "south": y,
            "compact_version": 1,
        }
    )
    return root / "tiles" / (key + ".json.gz")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--phase",
        choices=["plan", "acquire", "aggregate", "persist", "replay"],
        default="plan",
    )
    p.add_argument("--execute-national", action="store_true")
    a = p.parse_args()
    config = json.loads(CONFIG.read_text())
    full = config.get("acquisition_mode") == "full_reacquisition"
    request_cap = int(config["maximum_new_cds_requests"])
    if config.get("concurrency") != 1 or not 1 <= request_cap <= 100:
        p.error("Sequential execution and at most 100 CDS requests required")
    if a.phase != "plan":
        if not a.execute_national or config["execution_authorized"] is not True:
            p.error(
                "National execution is prepared only; separate authorization required"
            )
        if (
            os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
            != "https://yyfbpecxvxglzxopsmel.supabase.co"
        ):
            p.error("Only agriclimax-dev is eligible")
        if (
            json.loads(
                Path("docs/codex/verification/task19c/measurements.json").read_text()
            )["decision"]
            != "READY_FOR_713x30"
        ):
            p.error("Task19C readiness evidence required")
    checks = json.loads((BUNDLE / "checksums.json").read_text())
    if set(checks) != {
        "reference.json",
        "weights.json",
        "manifest.json",
        "source-properties.json",
    }:
        raise ValueError("Incomplete reference")
    for name, sha in checks.items():
        if hashlib.sha256((BUNDLE / name).read_bytes()).hexdigest() != sha:
            raise ValueError("Reference checksum mismatch")
    reference = json.loads((BUNDLE / "manifest.json").read_text())["reference_version"]
    territories, _ = load_reference(
        json.loads((BUNDLE / "reference.json").read_text()), version=reference
    )
    weights = [Weight(**w) for w in json.loads((BUNDLE / "weights.json").read_text())]
    if len(territories) != 713 or len(weights) != 14541:
        raise ValueError("National reference changed")
    release = dataset().model_copy(update={"dataset_version": NATIONAL_EDITION})
    tiles = {(math.floor(w.longitude), math.floor(w.latitude)) for w in weights}
    groups = sorted({(x // 2 * 2, y // 2 * 2) for x, y in tiles})
    pilot_ids = {
        r["id"]
        for r in json.loads(Path("config/pilots/pra73-v1.json").read_text())[
            "selection"
        ]
    }
    pilot_groups = {
        (math.floor(w.longitude) // 2 * 2, math.floor(w.latitude) // 2 * 2)
        for w in weights
        if w.pra_id in pilot_ids
    }
    missing = sorted(set(groups) - pilot_groups)
    plan = {
        **config,
        "source_groups": len(groups),
        "tiles": len(tiles),
        "weights": len(weights),
        "native_cells": len({w.cell_id for w in weights}),
        "missing_source_groups": groups if full else missing,
        "expected_cds_requests": len(groups) * 2 if full else len(missing) * 3,
        "cache_request_indexes_reused": 0 if full else 81,
        "incremental_cds_requests": len(groups) * 2 if full else len(missing) * 3,
        "daily_rows_new_national_edition": 713 * 30,
        "national_batches": 713 * 5,
        "pilot_rows_retained": 73 * 30,
        "no_diagnostics_generated": True,
        "commands": [
            f"PYTHONPATH=engine/src python scripts/pra_national_30day.py --phase {phase} --execute-national"
            for phase in ["acquire", "aggregate", "persist", "replay"]
        ],
    }
    plan["commands"].insert(2, config["independent_validation_command"])
    if a.phase == "plan":
        selection = Path("work/task19d/pra713-selection.json")
        selection.parent.mkdir(parents=True, exist_ok=True)
        selection.write_text(
            json.dumps(
                {
                    "reference_version": reference,
                    "selection_count": 713,
                    "selection": [{"id": t.id} for t in territories],
                },
                sort_keys=True,
            )
        )
        dest = Path("work/task19c/national-prepared.json")
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(plan, indent=2) + "\n")
        print(json.dumps(plan, indent=2))
        return
    ROOT.mkdir(parents=True, exist_ok=True)
    execution_plan = ROOT / "execution-plan.json"
    identity_plan = {
        "dataset": release.model_dump(mode="json"),
        "mode": config.get("acquisition_mode", "reuse"),
        "windows": [[str(s), str(e)] for s, e in ALL_WINDOWS],
        "request_cap": request_cap,
    }
    if (
        execution_plan.exists()
        and json.loads(execution_plan.read_text()) != identity_plan
    ):
        raise ValueError("Immutable execution plan mismatch")
    atomic_write(execution_plan, json.dumps(identity_plan, sort_keys=True).encode())
    if a.phase == "acquire" and not full:
        if (
            len(list((PILOT_ROOT / "source-cache/requests").glob("*.json"))) != 54
            or len(list((OLD_ROOT / "source-cache/requests").glob("*.json"))) != 27
        ):
            raise ValueError(
                "Restore the complete verified pilot cache before national acquisition"
            )
        alias_cache(PILOT_ROOT, ROOT, dataset(), release)
        alias_cache(
            OLD_ROOT,
            ROOT,
            dataset().model_copy(update={"dataset_version": OLD_EDITION}),
            release,
        )
    metrics_path = ROOT / (a.phase + "-metrics.json")
    metrics: dict[str, Any] = {"requests": [], "batches": [], "phase": a.phase}
    previous = 0.0
    if a.phase == "acquire" and metrics_path.exists():
        metrics = json.loads(metrics_path.read_text())
        previous = metrics["elapsed_seconds"]
    begin = time.monotonic()

    def save() -> None:
        metrics["elapsed_seconds"] = previous + time.monotonic() - begin
        metrics["peak_rss_kib"] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        atomic_write(metrics_path, json.dumps(metrics, indent=2).encode())

    def retrieve(request: dict[str, object], target: Path) -> None:
        if len(metrics["requests"]) >= request_cap:
            raise ValueError("Authorized CDS request budget exceeded")
        mark = time.monotonic()
        row: dict[str, Any] = {"request": request, "status": "started"}
        metrics["requests"].append(row)
        save()
        try:
            cds_retrieve(request, target)
            row.update(status="downloaded", bytes=target.stat().st_size)
        except (RuntimeError, OSError):
            row["status"] = "failed"
            raise
        finally:
            row["seconds"] = time.monotonic() - mark
            save()

    provider = Era5LandProvider(release, ROOT / "source-cache", retrieve=retrieve)
    if a.phase == "acquire":
        spans = (
            [(START, LAST, ALL_WINDOWS)]
            if full
            else [
                (START, END, WINDOWS),
                (date(2026, 10, 12), LAST, [ALL_WINDOWS[-1]]),
            ]
        )
        for first, last, windows in spans:
            for west, south in groups:
                wanted = [
                    (x, y)
                    for x, y in tiles
                    if x // 2 * 2 == west and y // 2 * 2 == south
                ]
                archives = [
                    tile(ROOT, release, x, y, s, e)
                    for x, y in wanted
                    for s, e in windows
                ]
                if all(path.exists() for path in archives):
                    for path in archives:
                        if (
                            hashlib.sha256(path.read_bytes()).hexdigest()
                            != path.with_suffix(".sha256").read_text()
                        ):
                            raise ValueError("Tile checksum mismatch")
                    continue
                if (
                    sum(
                        path.stat().st_size
                        for path in ROOT.rglob("*")
                        if path.is_file()
                    )
                    > 448 * 1024**2
                ):
                    raise ValueError("Existing cache budget exceeded")
                refs = provider.acquire((west, south, west + 2, south + 2), first, last)
                rows = [
                    (
                        math.floor(round(r.longitude, 1)),
                        math.floor(round(r.latitude, 1)),
                        compact(r),
                    )
                    for r in refs
                ]
                for x, y in wanted:
                    for s, e in windows:
                        selected = [
                            row
                            for rx, ry, row in rows
                            if (rx, ry) == (x, y)
                            and str(s) <= str(row["valid_date"]) <= str(e)
                        ]
                        if len(selected) != 100 * ((e - s).days + 1):
                            raise ValueError("Incomplete native tile")
                        content = gzip.compress(
                            json.dumps(
                                {"rows": selected, "source": refs[0].source_request},
                                sort_keys=True,
                                allow_nan=False,
                            ).encode(),
                            mtime=0,
                        )
                        path = tile(ROOT, release, x, y, s, e)
                        if path.exists() and path.read_bytes() != content:
                            raise ValueError("Immutable tile conflict")
                        atomic_write(path, content)
                        atomic_write(
                            path.with_suffix(".sha256"),
                            hashlib.sha256(content).hexdigest().encode(),
                        )
                print(
                    "Verified source extent",
                    west,
                    south,
                    "requests",
                    len(metrics["requests"]),
                    flush=True,
                )
        if not full:
            boundary_equal(ROOT, ROOT, expected_groups=30)
    else:
        if a.phase in {"persist", "replay"}:
            proof = json.loads(Path("work/task19d/independent.json").read_text())
            verify_proof_inputs(ROOT, proof)
            if (
                proof["dataset_identity"] != release.model_dump(mode="json")
                or proof["pra_batches"] != 3565
                or proof["native_cell_days"] != 205830
                or proof["maximum_source_reduction_error"] > 1e-6
                or proof["maximum_spatial_aggregate_error"] > 1e-6
            ):
                raise ValueError(
                    "Independent national validation required before writes"
                )
        repo = (
            PraRepository(reference, NATIONAL_EDITION)
            if a.phase in {"persist", "replay"}
            else None
        )
        for s, e in ALL_WINDOWS:
            for territory in territories:
                report = run_batch(
                    provider,
                    territory,
                    weights,
                    s,
                    e,
                    ROOT,
                    max_downloads=0,
                    persist=repo.persist if repo else None,
                )
                if report["status"] == "processing":
                    raise ValueError("Source cache incomplete")
                if a.phase == "replay":
                    assert repo is not None
                    repo.persist(
                        json.loads(
                            (
                                ROOT / "batches" / report["batch_key"] / "output.json"
                            ).read_text()
                        )
                    )
                metrics["batches"].append(report)
                save()
        print(a.phase, "3565 national batches")
    save()


if __name__ == "__main__":
    main()
