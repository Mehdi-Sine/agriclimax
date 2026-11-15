"""Bounded, single-writer rolling SIM recovery; private candidates only.

Eight fixed slots, each at most 2 MiB, plus a 4 KiB pointer. Never calls
publication, creates infrastructure, deletes objects or rewrites old archives.
Workflow concurrency must serialize restore/collect/save as one transaction.
"""
from __future__ import annotations

import argparse
import base64
import gzip
import io
import json
import shutil
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from agriclimax.climate.safran_incremental import LIMIT, serialized, sha
from couv03b_checkpoint import digest, private_bucket, validate
from pra_weather_store import BUCKET, ArchiveStore

PREFIX = "candidates/safran-sim/v1/rolling"
POINTER = f"{PREFIX}/latest.json"
SLOTS = 8
MAX_SLOT = 2 * 1024**2


def pointer(remote: ArchiveStore) -> dict[str, Any] | None:
    raw = remote.request(f"object/{BUCKET}/{POINTER}")
    if not raw:
        return None
    if len(raw) > 4096:
        raise ValueError("SIM pointer budget")
    p = json.loads(raw)
    if (p.get("version") != "sim-rolling-1" or type(p.get("generation")) is not int
            or p["generation"] < 0 or type(p.get("slot")) is not int
            or p["slot"] != p["generation"] % SLOTS
            or type(p.get("bytes")) is not int or not 0 < p["bytes"] <= MAX_SLOT):
        raise ValueError("SIM pointer contract")
    digest(p["sha256"])
    return p


def put(remote: ArchiveStore, path: str, raw: bytes) -> None:
    remote.request(f"object/{BUCKET}/{path}", "POST", raw, upsert=True)
    if remote.request(f"object/{BUCKET}/{path}") != raw:
        raise ValueError("SIM rolling readback mismatch")


def save(root: Path, remote: ArchiveStore) -> dict[str, Any]:
    manifest = validate(root)
    private_bucket(remote)
    previous = pointer(remote)
    blobs = {}
    for entries in manifest["index"]["days"].values():
        for entry in entries:
            checksum = digest(entry["sha256"])
            raw = (root / "blobs" / f"{checksum}.json.gz").read_bytes()
            if sha(raw) != checksum or len(raw) != entry["bytes"]:
                raise ValueError("SIM revision integrity")
            blobs[checksum] = base64.b64encode(raw).decode("ascii")
    raw = gzip.compress(serialized({"manifest": manifest, "blobs": blobs}), mtime=0)
    if len(raw) > MAX_SLOT:
        raise ValueError("SIM rolling slot budget; previous checkpoint preserved")
    checksum = sha(raw)
    if previous and previous["sha256"] == checksum:
        return {**previous, "status": "unchanged", "writes": 0}
    generation = previous["generation"] + 1 if previous else 0
    slot = generation % SLOTS
    receipt = {"version": "sim-rolling-1", "generation": generation, "slot": slot,
               "sha256": checksum, "bytes": len(raw),
               "saved_at": datetime.now(UTC).isoformat()}
    # The next slot cannot overwrite the currently committed slot.
    put(remote, f"{PREFIX}/slot-{slot}.json.gz", raw)
    put(remote, POINTER, serialized(receipt))
    return {**receipt, "status": "saved", "writes": 2,
            "remote_budget_bytes": SLOTS * MAX_SLOT + 4096}


def restore(root: Path, remote: ArchiveStore) -> dict[str, Any]:
    if root.exists() or root.is_symlink():
        raise ValueError("SIM rolling restore requires a new destination")
    private_bucket(remote)
    p = pointer(remote)
    if p is None:
        return {"status": "empty", "remote_writes": 0}
    raw = remote.blob(f"{PREFIX}/slot-{p['slot']}.json.gz", p["sha256"])
    if len(raw) != p["bytes"]:
        raise ValueError("SIM rolling slot size")
    # Bound inflation independently from the compressed slot and base64 size.
    with gzip.GzipFile(fileobj=io.BytesIO(raw)) as stream:
        decoded = stream.read(2 * LIMIT + 1)
    if len(decoded) > 2 * LIMIT:
        raise ValueError("SIM rolling decompression budget")
    payload = json.loads(decoded)
    manifest = payload["manifest"]
    if manifest["version"] != "sim-private-checkpoint-1":
        raise ValueError("SIM rolling manifest version")
    root.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=root.parent) as scratch:
        staged = Path(scratch) / "candidate"
        (staged / "blobs").mkdir(parents=True)
        (staged / "index.json").write_bytes(serialized(manifest["index"]))
        (staged / "report.json").write_bytes(serialized(manifest["report"]))
        total = 0
        for entries in manifest["index"]["days"].values():
            for entry in entries:
                checksum = digest(entry["sha256"])
                blob = base64.b64decode(payload["blobs"][checksum], validate=True)
                total += len(blob)
                if total > LIMIT or len(blob) != entry["bytes"] or sha(blob) != checksum:
                    raise ValueError("SIM rolling revision integrity or budget")
                (staged / "blobs" / f"{checksum}.json.gz").write_bytes(blob)
        validate(staged)
        shutil.move(str(staged), str(root))
    return {**p, "status": "restored", "remote_writes": 0}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["save", "restore"])
    parser.add_argument("--root", required=True, type=Path)
    args = parser.parse_args()
    remote = ArchiveStore(read_only=args.mode == "restore")
    print(json.dumps(save(args.root, remote) if args.mode == "save" else restore(args.root, remote)))


if __name__ == "__main__":
    main()
