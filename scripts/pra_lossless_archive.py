"""Portable exact-byte compact checkpoints; verification never writes the database."""

import argparse
import gzip
import hashlib
import json
from pathlib import Path

from agriclimax.ingestion.storage import atomic_write


def pack(root: Path, target: Path) -> dict[str, object]:
    records = []
    raw_bytes = 0
    for path in sorted(root.glob("batches/*/output.json")):
        raw = path.read_bytes()
        # Parse only to validate envelope; original serialized bytes remain untouched.
        envelope = json.loads(raw)
        if envelope["batch_key"] != path.parent.name or len(path.parent.name) != 64:
            raise ValueError("Archive batch identity mismatch")
        checksum = hashlib.sha256(raw).hexdigest()
        records.append(
            {
                "path": str(path.relative_to(root)),
                "sha256": checksum,
                "content": raw.decode(),
            }
        )
        raw_bytes += len(raw)
    if not records:
        raise ValueError("No immutable outputs to archive")
    content = gzip.compress(
        json.dumps(
            {"archive_version": "pra-exact-bytes-1", "records": records}, sort_keys=True
        ).encode(),
        mtime=0,
    )
    atomic_write(target, content)
    checksum = hashlib.sha256(content).hexdigest()
    receipt = {
        "archive_version": "pra-exact-bytes-1",
        "sha256": hashlib.sha256(content).hexdigest(),
        "envelopes": len(records),
        "uncompressed_output_bytes": raw_bytes,
        "archive_bytes": len(content),
    }
    atomic_write(target.with_suffix(".sha256"), checksum.encode())
    atomic_write(target.with_suffix(".json"), json.dumps(receipt, indent=2).encode())
    return receipt


def restore(archive: Path, target: Path) -> int:
    raw = archive.read_bytes()
    if hashlib.sha256(raw).hexdigest() != archive.with_suffix(".sha256").read_text():
        raise ValueError("Archive checksum mismatch")
    doc = json.loads(gzip.decompress(raw))
    if doc["archive_version"] != "pra-exact-bytes-1":
        raise ValueError("Unknown archive contract")
    # Validate every entry before writing anything. No absolute/traversal/symlink path.
    entries = []
    for r in doc["records"]:
        path = Path(r["path"])
        content = r["content"].encode()
        if (
            len(path.parts) != 3
            or path.parts[0] != "batches"
            or path.parts[2] != "output.json"
            or len(path.parts[1]) != 64
            or any(c not in "abcdef0123456789" for c in path.parts[1])
            or hashlib.sha256(content).hexdigest() != r["sha256"]
        ):
            raise ValueError("Invalid archive entry")
        destination = target / path
        if not destination.resolve().is_relative_to(target.resolve()):
            raise ValueError("Unsafe archive path")
        if destination.exists() and destination.read_bytes() != content:
            raise ValueError("Immutable destination conflict")
        entries.append((destination, content))
    if len({str(p) for p, _ in entries}) != len(entries):
        raise ValueError("Duplicate archive entries")
    for path, content in entries:
        atomic_write(path, content)
    return len(entries)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("mode", choices=["pack", "restore"])
    p.add_argument("--root", type=Path, required=True)
    p.add_argument("--archive", type=Path, required=True)
    args = p.parse_args()
    print(
        json.dumps(
            pack(args.root, args.archive)
            if args.mode == "pack"
            else {"restored": restore(args.archive, args.root)}
        )
    )


if __name__ == "__main__":
    main()
