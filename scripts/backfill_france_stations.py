"""Run Task11 in serial ten-station chunks, with explicit invocation budgets."""

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

from agriclimax.ingestion.storage import atomic_write


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalogue", type=Path, required=True)
    parser.add_argument("--from", dest="start", type=date.fromisoformat, required=True)
    parser.add_argument("--to", dest="end", type=date.fromisoformat, required=True)
    parser.add_argument("--max-chunks", type=int, required=True)
    parser.add_argument(
        "--product", choices=["climatology", "observations"], default="climatology"
    )
    parser.add_argument("--root", type=Path, default=Path("work/france-stations"))
    args = parser.parse_args()
    if not 0 <= (args.end - args.start).days <= 6 or not 1 <= args.max_chunks <= 2:
        parser.error("Budgets: 1-7 days, 1-2 chunks (<=20 stations)")
    catalogue = json.loads(args.catalogue.read_text())
    ids = [row["id"] for row in catalogue["stations"]]
    if not 1 <= len(ids) <= 96 or len(set(ids)) != len(ids):
        parser.error("Unique 1-96 selected stations required")
    identity = hashlib.sha256(
        json.dumps(
            {
                "ids": ids,
                "from": str(args.start),
                "to": str(args.end),
                "product": args.product,
                "catalog_sha256": catalogue["catalog_sha256"],
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()
    completed = 0
    for index in range(0, len(ids), 10):
        root = args.root / identity / str(index // 10)
        checkpoint = root / "complete.json"
        if checkpoint.exists():
            continue
        if completed >= args.max_chunks:
            break
        result = subprocess.run(
            [
                sys.executable,
                "scripts/ingest_weather.py",
                "--mode",
                "live_meteofrance",
                "--product",
                args.product,
                "--stations",
                ",".join(ids[index : index + 10]),
                "--from",
                str(args.start),
                "--to",
                str(args.end),
                "--root",
                str(root),
            ],
            check=False,
        )
        if result.returncode:
            return result.returncode
        atomic_write(
            checkpoint,
            json.dumps(
                {"identity": identity, "stations": ids[index : index + 10]}
            ).encode(),
        )
        completed += 1
    print(
        json.dumps(
            {"completed_chunks_this_run": completed, "max_chunks": args.max_chunks}
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
