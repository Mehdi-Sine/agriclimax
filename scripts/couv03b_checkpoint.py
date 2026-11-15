"""Manual durable SIM checkpoint in the existing private bucket, no publication.

No bucket creation, current/catalogue mutation, deletion or automatic scheduling.
Restore requires the exact checkpoint digest from the save receipt.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import tempfile
from datetime import date
from pathlib import Path
from typing import Any

from agriclimax.climate.safran_incremental import LIMIT, CandidateStore, serialized, sha
from pra_weather_store import BUCKET, ArchiveStore

PREFIX = "candidates/safran-sim/v1"


def digest(value: str) -> str:
    if not re.fullmatch(r"[a-f0-9]{64}", value):
        raise ValueError("Exact SHA256 required")
    return value


def validate(root: Path) -> dict[str, Any]:
    if root.is_symlink() or any(p.is_symlink() for p in root.rglob("*")):
        raise ValueError("Candidate symlinks forbidden")
    store = CandidateStore(root)
    if not (root / "index.json").exists() or not store.index()["days"]:
        raise ValueError("Nonempty candidate index required")
    if sum(p.stat().st_size for p in root.rglob("*") if p.is_file()) > LIMIT:
        raise ValueError("Candidate checkpoint budget exceeded")
    inventory = csv.DictReader(Path("docs/codex/COUV-02/evidence/national-713.csv").read_text().splitlines())
    targets = {r["pra_id"] for r in inventory if float(r["era_fraction"]) < .9}
    for text in store.index()["days"]:
        rows = store.read(date.fromisoformat(text))
        if len(rows) != 160 or {r["pra_id"] for r in rows} != targets:
            raise ValueError("Only the 32-PRA canary may be persisted")
        if any(r["source"] != "meteo-france-sim" for r in rows):
            raise ValueError("SIM candidate rows required")
    report = json.loads((root / "report.json").read_bytes())
    if report["journal_eligible"] is not False or report["indicator_eligible"] is not False:
        raise ValueError("Candidate must remain ineligible")
    if report["pra_count"] != 32:
        raise ValueError("Targeted report required")
    return {"version": "sim-private-checkpoint-1", "index": store.index(), "report": report}


def private_bucket(remote: ArchiveStore) -> None:
    buckets = json.loads(remote.request("bucket"))
    bucket = next((b for b in buckets if b["id"] == BUCKET), None)
    if not bucket or bucket["public"]:
        raise ValueError("Existing private bucket required; never create infrastructure")


def save(root: Path, remote: ArchiveStore) -> dict[str, object]:
    manifest = validate(root)
    private_bucket(remote)
    for entries in manifest["index"]["days"].values():
        for entry in entries:
            checksum = digest(entry["sha256"])
            raw = (root / "blobs" / f"{checksum}.json.gz").read_bytes()
            if sha(raw) != checksum or len(raw) != entry["bytes"]:
                raise ValueError("All revisions must verify before upload")
    # Upload content-addressed blobs first, publish only an immutable candidate manifest.
    for entries in manifest["index"]["days"].values():
        for entry in entries:
            checksum = entry["sha256"]
            remote.put_immutable(f"{PREFIX}/blobs/{checksum}.json.gz",
                                 (root / "blobs" / f"{checksum}.json.gz").read_bytes())
    raw = serialized(manifest)
    checksum = sha(raw)
    remote.put_immutable(f"{PREFIX}/checkpoints/{checksum}.json", raw)
    return {"checkpoint_sha256": checksum, "prefix": PREFIX, "bucket": BUCKET,
            "requests": remote.requests, "writes": remote.writes,
            "published_catalogue_writes": 0}


def restore(root: Path, checksum: str, remote: ArchiveStore) -> dict[str, object]:
    checksum = digest(checksum)
    if root.exists():
        raise ValueError("Restore requires a new destination; preserve local checkpoint")
    private_bucket(remote)
    raw = remote.blob(f"{PREFIX}/checkpoints/{checksum}.json", checksum)
    manifest = json.loads(raw)
    if manifest["version"] != "sim-private-checkpoint-1":
        raise ValueError("Unsupported checkpoint version")
    root.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=root.parent) as temporary:
        staged = Path(temporary) / "candidate"
        (staged / "blobs").mkdir(parents=True)
        (staged / "index.json").write_bytes(serialized(manifest["index"]))
        (staged / "report.json").write_bytes(serialized(manifest["report"]))
        index = CandidateStore(staged).index()
        total = 0
        for entries in index["days"].values():
            for entry in entries:
                total += entry["bytes"]
                if entry["bytes"] <= 0 or total > LIMIT:
                    raise ValueError("Restore budget exceeded")
                checksum_blob = digest(entry["sha256"])
                blob = remote.blob(f"{PREFIX}/blobs/{checksum_blob}.json.gz", checksum_blob)
                if len(blob) != entry["bytes"]:
                    raise ValueError("Restore size mismatch")
                (staged / "blobs" / f"{checksum_blob}.json.gz").write_bytes(blob)
        validate(staged)
        shutil.move(str(staged), str(root))
    return {"restored": True, "checkpoint_sha256": checksum, "remote_writes": 0}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["save", "restore"])
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--checkpoint-sha256")
    args = parser.parse_args()
    if args.mode == "restore" and not args.checkpoint_sha256:
        parser.error("restore requires --checkpoint-sha256")
    remote = ArchiveStore(read_only=args.mode == "restore")
    result = (save(args.root, remote) if args.mode == "save"
              else restore(args.root, args.checkpoint_sha256, remote))
    print(json.dumps(result))


if __name__ == "__main__":
    main()
