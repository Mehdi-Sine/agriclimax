"""Bounded incremental SIM candidate, reusing COUV-01/02 science and transport.

No remote writes. Production switch is separate from this manual qualification CLI.
"""
from __future__ import annotations

import argparse
import csv
import fcntl
import gzip
import json
import resource
import signal
import tempfile
import time
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

from agriclimax.climate.safran import VARIABLES, CellWeight, aggregate, cell_id
from agriclimax.climate.safran_incremental import CandidateStore, serialized, sha
from safran_pilot import CATALOGUE, Acquisition, acquire

FROZEN = Path("docs/codex/COUV-01/evidence")


def weights() -> tuple[dict[str, list[CellWeight]], str]:
    raw = gzip.decompress((FROZEN / "weights.json.gz").read_bytes())
    support = json.loads(raw)
    if sha(raw) != json.loads((FROZEN / "summary.json").read_bytes())["support_sha256"]:
        raise ValueError("COUV-02 reused support checksum mismatch")
    reference = Path("config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json")
    if sha(reference.read_bytes()) != support["reference_sha256"]:
        raise ValueError("Official reference changed; requalification required")
    result: dict[str, list[CellWeight]] = defaultdict(list)
    for r in support["records"]:
        result[r["pra_id"]].append(CellWeight(r["cell_id"], r["weight"]))
    return dict(result), sha(raw)


def collect(source: Path, store: CandidateStore, start: date, end: date,
            today: date, *, national: bool = False) -> dict[str, Any]:
    import pyarrow.parquet as pq

    begun = time.monotonic()
    if end < start or (end - start).days > 6 or end > today:
        raise ValueError("One to seven recent explicit dates required")
    all_weights, support_sha = weights()
    inventory = list(csv.DictReader(Path("docs/codex/COUV-02/evidence/national-713.csv").read_text().splitlines()))
    targets = {r["pra_id"] for r in inventory if float(r["era_fraction"]) < .9}
    if len(targets) != 32:
        raise ValueError("COUV-02 target allowlist changed")
    selected = all_weights if national else {p: all_weights[p] for p in sorted(targets)}
    existing_days = store.index()["days"]
    if existing_days:
        first = date.fromisoformat(min(existing_days))
        if {r["pra_id"] for r in store.read(first)} != set(selected):
            raise ValueError("Separate candidate roots required for national qualification")
    needed = {w.cell_id for ws in selected.values() for w in ws}
    catalog = json.loads((source / "catalogue.json").read_bytes())
    entry = next(r for r in catalog["resources"] if r["title"] == "QUOT_SIM2_latest")
    source_sha = sha((source / "latest.parquet").read_bytes())
    receipt = json.loads((source / "latest.parquet.receipt.json").read_bytes())
    if source_sha != receipt["sha256"]:
        raise ValueError("Source checksum mismatch")
    support = json.loads(gzip.decompress((FROZEN / "weights.json.gz").read_bytes()))
    if sha((source / "coordonnees_grille_safran_lambert-2-etendu.csv").read_bytes()) != support["grid_sha256"]:
        raise ValueError("Official SIM grid changed; requalification required")
    days: dict[date, dict[str, dict[str, object]]] = defaultdict(dict)
    available: set[date] = set()
    columns = ["LAMBX", "LAMBY", "DATE", *sorted({f for v in VARIABLES.values() for f in v.fields})]
    for batch in pq.ParquetFile(source / "latest.parquet").iter_batches(batch_size=20000, columns=columns):
        for r in batch.to_pylist():
            day = r.pop("DATE")
            available.add(day)
            if not start <= day <= end:
                continue
            cid = cell_id(r.pop("LAMBX"), r.pop("LAMBY"))
            if cid not in needed:
                continue
            if cid in days[day]:
                raise ValueError("Duplicate native SIM cell/day")
            days[day][cid] = r
    if not available or max(available) > today or len(available) > 60:
        raise ValueError("Invalid rolling source dates")
    writes, missing = 0, []
    for offset in range((end - start).days + 1):
        day = start + timedelta(days=offset)
        if day not in days:
            missing.append(str(day))
            continue
        rows = [aggregate(pra, day, variable, ws, days[day], source_sha256=source_sha,
                          support_sha256=support_sha,
                          acquired_at=entry["extras"]["analysis:last-modified-at"])
                for pra, ws in sorted(selected.items()) for variable in VARIABLES]
        writes += store.put(day, rows, today=today)
    return {"status": "partial" if missing else "success", "first_requested": str(start),
            "last_requested": str(end), "source_first": str(min(available)),
            "source_last": str(max(available)), "lag_days": (today-max(available)).days,
            "source_sha256": source_sha, "support_sha256": support_sha,
            "source_resource": entry, "source_receipt": receipt,
            "pra_count": len(selected), "contributing_cells": len(needed),
            "new_day_revisions": writes, "missing_dates": missing,
            "seconds": round(time.monotonic()-begun, 3),
            "peak_rss_kib": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
            "candidate_bytes": sum(p.stat().st_size for p in store.root.rglob('*') if p.is_file()),
            "remote_writes": 0, "journal_eligible": False, "indicator_eligible": False}


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root", type=Path, default=Path("work/era5-archive/sim-candidate"))
    p.add_argument("--source-root", type=Path)
    p.add_argument("--from", dest="start", type=date.fromisoformat)
    p.add_argument("--to", dest="end", type=date.fromisoformat)
    p.add_argument("--national", action="store_true", help="One-off qualification only")
    args = p.parse_args()
    if args.national and args.root == Path("work/era5-archive/sim-candidate"):
        p.error("National qualification requires a separate explicit --root")
    today = datetime.now(UTC).date()
    end = args.end or today - timedelta(days=1)
    start = args.start or end - timedelta(days=6)
    resource.setrlimit(resource.RLIMIT_AS, (4 * 1024**3, 4 * 1024**3))
    signal.alarm(115)
    args.root.mkdir(parents=True, exist_ok=True)
    lock = (args.root / ".collector.lock").open("a")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print(json.dumps({"status": "another_candidate_collector_running"}))
        return
    begun = time.monotonic()
    if args.source_root:
        report = collect(args.source_root, CandidateStore(args.root), start, end, today,
                         national=args.national)
        report.update(source_calls=0, source_bytes=0)
    else:
        if args.root == Path("work/era5-archive/sim-candidate"):
            used = sum(p.stat().st_size for p in args.root.parent.rglob("*") if p.is_file())
            if used + 16 * 1024**2 > 448 * 1024**2:
                raise ValueError("Shared ERA workspace has no room for bounded SIM transport")
        # Only one temporary rolling national transport, never retained as daily grids.
        with tempfile.TemporaryDirectory(prefix="sim-", dir="work") as scratch:
            source = Path(scratch)
            fetch = Acquisition(source)
            catalog = json.loads(fetch.get("catalogue.json", CATALOGUE).read_bytes())
            current = next(r for r in catalog["resources"] if r["title"] == "QUOT_SIM2_latest")
            previous_path = args.root / "report.json"
            previous = json.loads(previous_path.read_bytes()) if previous_path.exists() else None
            fingerprint = current["extras"].get("analysis:checksum")
            if (previous and previous["pra_count"] == 32 and not args.national and fingerprint
                    and fingerprint == previous["source_resource"]["extras"].get("analysis:checksum")):
                store = CandidateStore(args.root)
                available = store.index()["days"]
                requested = [start+timedelta(days=i) for i in range((end-start).days+1)]
                if end < start or len(requested) > 7 or end > today:
                    raise ValueError("One to seven recent explicit dates required")
                for day in requested:
                    if str(day) in available:
                        store.read(day)
                    elif str(day) <= previous["source_last"]:
                        break  # a new requested date needs actual acquisition/aggregation
                else:
                    report = {**previous, "first_requested": str(start), "last_requested": str(end),
                              "new_day_revisions": 0,
                              "missing_dates": [str(d) for d in requested if str(d) not in available],
                              "source_calls": fetch.calls, "source_bytes": fetch.bytes,
                              "status": "unchanged_source", "seconds": 0,
                              "lag_days": (today-date.fromisoformat(previous["source_last"])).days,
                              "peak_rss_kib": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
                              "candidate_bytes": sum(p.stat().st_size for p in args.root.rglob("*") if p.is_file())}
                    report["total_seconds"] = round(time.monotonic()-begun, 3)
                    previous_path.write_bytes(serialized(report))
                    print(json.dumps(report))
                    return
            counters = acquire(source)
            report = collect(source, CandidateStore(args.root), start, end, today,
                             national=args.national)
            report.update(source_calls=counters["source_calls"]+fetch.calls,
                          source_bytes=counters["source_bytes"]+fetch.bytes)
    report["total_seconds"] = round(time.monotonic()-begun, 3)
    (args.root / "report.json").write_bytes(serialized(report))
    print(json.dumps(report))


if __name__ == "__main__":
    main()
