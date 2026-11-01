"""Task22 annual daily normals: reuse Task21, bounded CDS spool, immutable checkpoints."""

from __future__ import annotations

import calendar
import concurrent.futures
import json
import time
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pra_climatology as core
from pra_climatology_acquire import one
from pra_climatology_annual import reduce_file, save_npz, support

ROOT = Path("work/task22")
EVIDENCE = Path("docs/codex/verification/task22")
METHOD = "pra-compact-daily-1"


def reused_days() -> set[int]:
    return {
        (date(2000, 9, 19) + timedelta(days=i)).timetuple().tm_yday for i in range(30)
    }


def requests() -> list[dict[str, Any]]:
    result = []
    for original in core.annual_requests():
        request: dict[str, Any] = dict(original)
        # Reuse published daily normals exactly. No historical cache survives this workspace.
        # Rain at midnight belongs to the previous day, including month/year boundaries.
        days = []
        for day in request["day"]:
            d = date(int(request["year"][0]), int(request["month"]), int(day))
            if request["variable"] == ["total_precipitation"]:
                d -= timedelta(days=1)
            if date(2000, d.month, d.day).timetuple().tm_yday not in reused_days():
                days.append(day)
        if days:
            request["day"] = days
            result.append(request)
    return result


def execute() -> None:
    budget = json.loads((EVIDENCE / "storage-budget.json").read_text())
    if (
        not budget["validated"]
        or budget["projected_total_database_bytes"] >= 200_000_000
    ):
        raise ValueError("Measured compact storage budget required")
    exported = json.loads((ROOT / "task21-export.json").read_text())[0]["payload"]
    if (ROOT / "manifest.json").exists():
        manifest = json.loads((ROOT / "manifest.json").read_text())
        if (
            manifest["method"] != METHOD
            or manifest["normal_cache_sha256"]
            != core.checksum(ROOT / "normal-cache.npz")
            or manifest["task21_export_sha256"]
            != core.checksum(ROOT / "task21-export.json")
        ):
            raise ValueError("Immutable annual output mismatch")
        for saved in manifest["sources"]:
            cp = ROOT / "checkpoints" / (core.identity(saved["request"]) + ".npz")
            if core.checksum(cp) != saved["sha256"]:
                raise ValueError("Immutable checkpoint mismatch")
        print("Annual computation already complete; validated checkpoints reused")
        return
    core.LABEL = "national"
    weights, ids = core.verify_bundle()
    positions, matrix, mask = support(weights, ids)
    history = np.full((30, 366, len(ids), 4), np.nan)
    occupied = np.zeros((30, 366, 4), dtype=bool)
    mark = time.monotonic()
    metadata = []
    plan = requests()
    core.document(
        ROOT / "plan.json",
        {
            "requests": plan,
            "concurrency": 3,
            "source_limit_bytes": core.SOURCE_LIMIT,
            "reused_rows": len(exported["rows"]),
        },
    )

    def acquire(request: dict[str, object]) -> dict[str, object]:
        key = core.identity(request)
        meta = ROOT / "checkpoints" / (key + ".json")
        if not meta.exists():
            one(request, root=ROOT)
        return request

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        pending = {pool.submit(acquire, r) for r in plan[:3]}
        remaining = iter(plan[3:])
        while pending:
            done, pending = concurrent.futures.wait(
                pending, return_when=concurrent.futures.FIRST_COMPLETED
            )
            for future in done:
                request = future.result()
                key = core.identity(request)
                cp = ROOT / "checkpoints" / (key + ".npz")
                meta = cp.with_suffix(".json")
                raw = ROOT / "sources" / (key + ".nc")
                if meta.exists():
                    saved = json.loads(meta.read_text())
                    if (
                        saved["method"] != METHOD
                        or saved["request"] != request
                        or saved["sha256"] != core.checksum(cp)
                    ):
                        raise ValueError("Immutable checkpoint collision")
                else:
                    receipt = json.loads(raw.with_suffix(".json").read_text())
                    if core.checksum(raw) != receipt["sha256"]:
                        raise ValueError("Source checksum mismatch")
                    y, d, v, values = reduce_file(raw, request, positions, matrix, mask)
                    save_npz(cp, year=y, day=d, variable=v, values=values)
                    saved = {
                        "method": METHOD,
                        "request": request,
                        "sha256": core.checksum(cp),
                        "source_receipt": receipt,
                        "geography": json.loads(
                            (core.BUNDLE / "checksums.json").read_text()
                        ),
                    }
                    core.document(meta, saved)
                if saved["geography"] != json.loads(
                    (core.BUNDLE / "checksums.json").read_text()
                ):
                    raise ValueError("Geography changed")
                with np.load(cp, allow_pickle=False) as data:
                    for y, d, v, values in zip(
                        data["year"], data["day"], data["variable"], data["values"]
                    ):
                        if occupied[y, d, v] or d + 1 in reused_days():
                            raise ValueError("Overlapping source assignment")
                        occupied[y, d, v] = True
                        history[y, d, :, v] = values
                if raw.exists():
                    if core.checksum(raw) != saved["source_receipt"]["sha256"]:
                        raise ValueError("Spool checksum mismatch before eviction")
                    raw.unlink()
                metadata.append(saved)
                core.document(
                    ROOT / "progress.json",
                    {
                        "completed": len(metadata),
                        "expected": len(plan),
                        "seconds": time.monotonic() - mark,
                    },
                )
                print("checkpoint", len(metadata), "/", len(plan), flush=True)
                next_request = next(remaining, None)
                if next_request is not None:
                    pending.add(pool.submit(acquire, next_request))
    for yi, year in enumerate(range(1991, 2021)):
        for month in range(1, 13):
            for day in range(1, calendar.monthrange(year, month)[1] + 1):
                di = date(2000, month, day).timetuple().tm_yday - 1
                if di + 1 not in reused_days() and not occupied[yi, di].all():
                    raise ValueError("Incomplete Gregorian acquisition")
    counts = np.isfinite(history).sum(axis=0).astype("int16")
    normals = np.full(counts.shape, np.nan)
    complete = counts == 30
    normals[complete] = history[:, complete].mean(axis=0)
    pi = {p: i for i, p in enumerate(ids)}
    seen = set()
    for pra, period, variable, value, n in exported["rows"]:
        di = date.fromisoformat("2000-" + period).timetuple().tm_yday - 1
        slot = (di, pi[pra], variable)
        if slot in seen or di + 1 not in reused_days():
            raise ValueError("Invalid Task21 reuse")
        seen.add(slot)
        normals[slot] = np.nan if value is None else value
        counts[slot] = n
    if len(seen) != 713 * 30 * 4:
        raise ValueError("Task21 reuse incomplete")
    save_npz(
        ROOT / "normal-cache.npz",
        normal=normals.astype("float32"),
        sample_years=counts,
        ids=np.array(ids),
    )
    core.document(
        ROOT / "manifest.json",
        {
            "method": METHOD,
            "pra": len(ids),
            "days": 366,
            "normal_rows": 713 * 366,
            "available_scalars": int(np.isfinite(normals).sum()),
            "reused_task21_scalars": len(seen),
            "task21_export_sha256": core.checksum(ROOT / "task21-export.json"),
            "normal_cache_sha256": core.checksum(ROOT / "normal-cache.npz"),
            "sources": sorted(metadata, key=lambda s: core.identity(s["request"])),
            "seconds": time.monotonic() - mark,
            "reference_years": [1991, 2020],
            "leap_day": "8 real years; normal NULL under unchanged 30-year completeness rule",
        },
    )


if __name__ == "__main__":
    execute()
