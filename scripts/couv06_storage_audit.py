"""Read-only existing SIM recovery and published-pointer invariance audit."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from couv04_checkpoint import MAX_SLOT, SLOTS, pointer, restore
from pra_weather_store import BUCKET, ArchiveStore


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    remote = ArchiveStore(read_only=True)
    before = {name: hashlib.sha256(remote.request(f"object/{BUCKET}/{name}")).hexdigest()
              for name in ("catalogue.json", "current.json")}
    prior = pointer(remote)
    receipt = restore(args.root, remote)
    after = {name: hashlib.sha256(remote.request(f"object/{BUCKET}/{name}")).hexdigest()
             for name in before}
    if before != after or pointer(remote) != prior:
        raise ValueError("Remote state changed during read-only audit")
    report = json.loads((args.root / "report.json").read_bytes()) if args.root.exists() else None
    result = {"restore": receipt, "checkpoint_report": report, "published_before": before,
              "published_after": after, "pointer_unchanged": True,
              "requests": remote.requests, "remote_writes": remote.writes,
              "remote_budget_bytes": SLOTS * MAX_SLOT + 4096}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"status": receipt["status"], "remote_writes": remote.writes}))


if __name__ == "__main__":
    main()
