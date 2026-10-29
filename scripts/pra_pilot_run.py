"""Explicit 73-PRA / seven-day real pilot. Sequential, cached, bounded, no schema writes."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import os
import resource
import time
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

from agriclimax.climate.coverage import compact
from agriclimax.climate.era5_land import Era5LandProvider, cds_retrieve
from agriclimax.climate.models import Dataset, ReferencePeriod
from agriclimax.ingestion.storage import atomic_write
from agriclimax.territories.pipeline import digest, run_batch
from agriclimax.territories.repository import PraRepository
from agriclimax.territories.spatial import Weight, load_reference
from agriclimax.wheat.models import Parameters

START = date(2026, 10, 12)
END = date(2026, 10, 18)
DATASET = "era5land-pilot73-20261012-20261018-v1"


def native_tile(longitude: float, latitude: float) -> tuple[int, int]:
    """Canonical identity of a validated native 0.1-degree point, including roundoff."""
    return math.floor(round(longitude, 1)), math.floor(round(latitude, 1))


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--phase",
        choices=["plan", "acquire", "aggregate", "persist", "replay"],
        default="plan",
    )
    p.add_argument("--sample", type=Path, default=Path("config/pilots/pra73-v1.json"))
    p.add_argument(
        "--bundle",
        type=Path,
        default=Path("config/coverage/ofb-masa-pra-2017-snapshot-20261017"),
    )
    p.add_argument("--root", type=Path, default=Path("work/task19b/real"))
    p.add_argument("--parameters", type=Path)
    p.add_argument("--from", dest="start", type=date.fromisoformat, default=START)
    p.add_argument("--to", dest="end", type=date.fromisoformat, default=END)
    p.add_argument("--dataset-version", default=DATASET)
    p.add_argument("--max-cds-requests", type=int, default=40)
    a = p.parse_args()
    if not 1 <= a.max_cds_requests <= 60:
        p.error("CDS budget must be between 1 and 60 logical requests")
    if (
        a.phase in {"persist", "replay"}
        and os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
        != "https://yyfbpecxvxglzxopsmel.supabase.co"
    ):
        p.error("Pilot writes are authorized only on agriclimax-dev")
    root: Path = a.root
    start: date = a.start
    end: date = a.end
    if (
        not 0 <= (end - start).days <= 6
        or start.year < 1950
        or end > datetime.now(UTC).date() - timedelta(days=5)
    ):
        p.error("One to seven completed ERA5 UTC days with publication delay required")
    sample = json.loads(a.sample.read_text())
    ids = {r["id"] for r in sample["selection"]}
    if len(ids) != 73 or sample["selection_count"] != 73:
        raise ValueError("Exactly 73 unique PRA required")
    checksums = json.loads((a.bundle / "checksums.json").read_text())
    if set(checksums) != {
        "reference.json",
        "weights.json",
        "manifest.json",
        "source-properties.json",
    }:
        raise ValueError("Unexpected or missing bundle member")
    for name, checksum in checksums.items():
        if hashlib.sha256((a.bundle / name).read_bytes()).hexdigest() != checksum:
            raise ValueError("Reference bundle checksum mismatch")
    territories, _ = load_reference(
        json.loads((a.bundle / "reference.json").read_text()),
        version=sample["reference_version"],
    )
    territories = [t for t in territories if t.id in ids]
    weights = [
        Weight(**w)
        for w in json.loads((a.bundle / "weights.json").read_text())
        if w["pra_id"] in ids
    ]
    tiles = {(math.floor(w.longitude), math.floor(w.latitude)) for w in weights}
    groups = sorted({(x // 2 * 2, y // 2 * 2) for x, y in tiles})
    if len(groups) > 40 or len(territories) != 73:
        raise ValueError("Pilot spatial budget exceeded")
    dataset = Dataset(
        dataset_version=a.dataset_version,
        reference_period=ReferencePeriod(
            start_year=1991, end_year=2020, minimum_years=24
        ),
    )
    plan = {
        "dataset": dataset.model_dump(mode="json"),
        "start": str(start),
        "end": str(end),
        "pra_count": 73,
        "native_cells": len({w.cell_id for w in weights}),
        "tiles": len(tiles),
        "groups": groups,
        "max_cds_requests": a.max_cds_requests,
        "concurrency": 1,
        "max_cache_bytes": 448 * 1024**2,
    }
    root.mkdir(parents=True, exist_ok=True)
    (root / "plan.json").write_text(json.dumps(plan, indent=2) + "\n")
    if a.phase == "plan":
        print(json.dumps(plan, indent=2))
        return
    metrics: dict[str, Any] = {
        "phase": a.phase,
        "requests": [],
        "groups": [],
        "pra": [],
    }
    previous_metrics = root / (a.phase + "-metrics.json")
    prior_seconds = 0.0
    if a.phase == "acquire" and previous_metrics.exists():
        metrics = json.loads(previous_metrics.read_text())
        metrics["resume_count"] = metrics.get("resume_count", 0) + 1
        prior_seconds = float(metrics.get("elapsed_seconds", 0))
    begin = time.monotonic()

    def save() -> None:
        metrics["elapsed_seconds"] = prior_seconds + time.monotonic() - begin
        metrics["peak_rss_kib"] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        atomic_write(
            root / (a.phase + "-metrics.json"), json.dumps(metrics, indent=2).encode()
        )

    def retrieve(request: dict[str, object], target: Path) -> None:
        if len(metrics["requests"]) >= a.max_cds_requests:
            raise ValueError("CDS request cap exceeded")
        mark = time.monotonic()
        row: dict[str, Any] = {
            "area": request["area"],
            "started_index": len(metrics["requests"]) + 1,
        }
        metrics["requests"].append(row)
        save()
        try:
            cds_retrieve(request, target)
            row.update(
                status="downloaded",
                bytes=target.stat().st_size,
                seconds=time.monotonic() - mark,
            )
        except (RuntimeError, OSError):
            row.update(status="failed", seconds=time.monotonic() - mark)
            raise
        finally:
            save()

    provider = Era5LandProvider(dataset, root / "source-cache", retrieve=retrieve)
    if a.phase == "acquire":
        for west, south in groups:
            wanted = {
                (x, y) for x, y in tiles if x // 2 * 2 == west and y // 2 * 2 == south
            }

            def archive(x: int, y: int) -> Path:
                key = digest(
                    {
                        "dataset": dataset.model_dump(mode="json"),
                        "start": str(start),
                        "end": str(end),
                        "west": x,
                        "south": y,
                        "compact_version": 1,
                    }
                )
                return root / "tiles" / (key + ".json.gz")

            if all(archive(x, y).exists() for x, y in wanted):
                for x, y in wanted:
                    dest = archive(x, y)
                    if (
                        hashlib.sha256(dest.read_bytes()).hexdigest()
                        != dest.with_suffix(".sha256").read_text()
                    ):
                        raise ValueError("Tile checksum mismatch")
                metrics["groups"].append(
                    {"west": west, "south": south, "status": "cache_hit"}
                )
                save()
                continue
            if (
                sum(f.stat().st_size for f in root.rglob("*") if f.is_file())
                > 448 * 1024**2
            ):
                raise ValueError("Disk budget exceeded")
            mark = time.monotonic()
            refs = provider.acquire((west, south, west + 2, south + 2), start, end)
            for x, y in sorted(wanted):
                rows = [
                    compact(r)
                    for r in refs
                    if native_tile(r.longitude, r.latitude) == (x, y)
                ]
                if len(rows) != 100 * ((end - start).days + 1):
                    raise ValueError(
                        "Expected 100 native points per complete UTC day in each tile"
                    )
                payload = {"rows": rows, "source": refs[0].source_request}
                content = gzip.compress(
                    json.dumps(payload, allow_nan=False, sort_keys=True).encode(),
                    mtime=0,
                )
                dest = archive(x, y)
                atomic_write(dest, content)
                atomic_write(
                    dest.with_suffix(".sha256"),
                    hashlib.sha256(content).hexdigest().encode(),
                )
            metrics["groups"].append(
                {
                    "west": west,
                    "south": south,
                    "status": "verified",
                    "seconds": time.monotonic() - mark,
                    "tiles": len(wanted),
                }
            )
            save()
            print(
                "Verified source group",
                len(metrics["groups"]),
                "/",
                len(groups),
                flush=True,
            )
    else:
        parameters = (
            Parameters.model_validate_json(a.parameters.read_text())
            if a.parameters
            else None
        )
        repo = (
            PraRepository(sample["reference_version"], a.dataset_version)
            if a.phase in {"persist", "replay"}
            else None
        )
        for t in territories:
            mark = time.monotonic()
            report = run_batch(
                provider,
                t,
                weights,
                start,
                end,
                root,
                max_downloads=0,
                parameters=parameters,
                persist=repo.persist if repo else None,
            )
            if report["status"] == "processing":
                raise ValueError("Source acquisition incomplete")
            # Explicit remote replay, even when the local completion checkpoint skips work.
            if a.phase == "replay":
                output = root / "batches" / report["batch_key"] / "output.json"
                assert repo is not None
                repo.persist(json.loads(output.read_text()))
            metrics["pra"].append(
                dict(pra=t.id, seconds=time.monotonic() - mark, **report)
            )
            save()
            print(a.phase, len(metrics["pra"]), "/", 73, flush=True)
    save()
    print("Pilot phase complete; no national execution", flush=True)


if __name__ == "__main__":
    main()
