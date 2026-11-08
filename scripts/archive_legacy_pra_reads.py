"""Read-only preservation of existing PRA daily RPC results, <=14 missing days/stage.

Never reacquires weather or writes Supabase. This exports legacy float4 PRA
aggregates, not native cell checkpoints and not exact-byte historical envelopes.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import resource
import signal
from datetime import date, timedelta
from pathlib import Path

from agriclimax.ingestion.storage import atomic_write
from agriclimax.territories.national_daily import DATASET, REFERENCE
from agriclimax.territories.repository import PraRepository


def serialized(value: object) -> bytes:
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), allow_nan=False
    ).encode()


def immutable(path: Path, raw: bytes) -> None:
    if path.exists():
        if path.read_bytes() != raw:
            raise ValueError("Immutable legacy checkpoint conflict")
        return
    atomic_write(path, raw)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", required=True, type=date.fromisoformat)
    parser.add_argument("--end", required=True, type=date.fromisoformat)
    parser.add_argument("--root", type=Path, default=Path("work/couv01/legacy"))
    parser.add_argument("--max-days", type=int, default=14)
    args = parser.parse_args()
    if not 1 <= args.max_days <= 14 or not 0 <= (args.end - args.start).days <= 59:
        raise ValueError("At most 14 new dates/stage and 60 requested dates")
    resource.setrlimit(resource.RLIMIT_AS, (4 * 1024**3, 4 * 1024**3))
    signal.alarm(1320)
    repository = PraRepository(REFERENCE, DATASET)
    catalog = repository.catalog()  # one read RPC; <=113 total read RPCs/stage
    reference = json.loads(
        Path("config/coverage", REFERENCE, "reference.json").read_bytes()
    )
    expected = {"pra:" + f["properties"]["code"] for f in reference["features"]}
    if len(expected) != 713:
        raise ValueError("713 official PRA required")
    acquired = 0
    entries = []
    dates = [
        args.start + timedelta(days=i) for i in range((args.end - args.start).days + 1)
    ]
    for day in dates:
        path = args.root / f"{day}.json.gz"
        receipt = args.root / f"{day}.receipt.json"
        if path.exists() and receipt.exists():
            entry = json.loads(receipt.read_bytes())
            raw = path.read_bytes()
            if hashlib.sha256(raw).hexdigest() != entry["sha256"]:
                raise ValueError("Legacy checkpoint checksum mismatch")
        else:
            if acquired >= args.max_days:
                continue
            if str(day) not in catalog["days"]:
                raise ValueError("Requested date absent from actual legacy catalogue")
            rows = repository.read_day(str(day))
            if (
                len(rows) != 713
                or {r["id"] for r in rows} != expected
                or any(
                    r["valid_date"] != str(day) or not r.get("batch_key") for r in rows
                )
            ):
                raise ValueError("Incomplete legacy identities/day/provenance")
            raw = gzip.compress(
                serialized(
                    {
                        "archive_version": "pra-legacy-read-1",
                        "reference_version": REFERENCE,
                        "dataset_version": DATASET,
                        "date": str(day),
                        "transport": "existing read-only PRA RPC; float4 values preserved",
                        "rows": rows,
                    }
                ),
                mtime=0,
            )
            if len(raw) > 8 * 1024**2:
                raise ValueError("Existing object budget exceeded")
            entry = {
                "date": str(day),
                "sha256": hashlib.sha256(raw).hexdigest(),
                "bytes": len(raw),
                "complete_pra": sum(
                    r["status"] == "available" and min(r["coverage"]) >= 0.9999
                    for r in rows
                ),
            }
            used = sum(p.stat().st_size for p in args.root.rglob("*") if p.is_file())
            if used + len(raw) > 448 * 1024**2:
                raise ValueError("Existing workspace budget exceeded")
            immutable(path, raw)
            immutable(receipt, serialized(entry))
            acquired += 1
        entries.append(entry)
    report = {
        "archive_version": "pra-legacy-read-index-1",
        "source_catalogue": catalog,
        "dates": entries,
        "new_days": acquired,
        "missing_dates": [
            str(d) for d in dates if str(d) not in {e["date"] for e in entries}
        ],
        "read_rpc_upper_bound": 1 + 8 * acquired,
        "remote_writes": 0,
    }
    args.root.mkdir(parents=True, exist_ok=True)
    (args.root / "manifest.json").write_bytes(serialized(report))
    print(
        json.dumps(
            {k: v for k, v in report.items() if k not in {"dates", "source_catalogue"}}
        )
    )


if __name__ == "__main__":
    main()
