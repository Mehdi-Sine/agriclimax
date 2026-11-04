"""Keep byte-identical RPG Parcelles source layers in a compact persistent cache.

Only redundant copies of verified, completed official deliveries can be evicted.
The full Parcelles GeoPackage remains recoverable, with original and cache SHA256.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import lzma
import shutil
from pathlib import Path

from agriclimax.ingestion.storage import atomic_write

REGIONS = {"11", "24", "27", "28", "32", "44", "52", "53", "75", "76", "84", "93", "94"}


def sha256(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def owned(path: Path, root: Path) -> Path:
    resolved = path.resolve()
    if path.is_symlink() or not resolved.is_relative_to(root.resolve()):
        raise ValueError("Cache path escapes its owned region directory")
    return resolved


def restore(cache: Path, region: str) -> Path:
    if region not in REGIONS:
        raise ValueError("Unknown region")
    proof = json.loads((cache / f"R{region}-source-cache.json").read_text())
    compressed = owned(cache / f"R{region}-Parcelles.gpkg.xz", cache)
    if sha256(compressed) != proof["compressed_sha256"]:
        raise ValueError("Compressed source cache checksum mismatch")
    target = owned(cache / proof["gpkg_relative_path"], cache / f"R{region}-extract")
    if not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        with lzma.open(compressed, "rb") as inp, target.open("wb") as out:
            shutil.copyfileobj(inp, out, 1024 * 1024)
    if sha256(target) != proof["gpkg_sha256"]:
        raise ValueError("Restored source GeoPackage checksum mismatch")
    return target


def compact(cache: Path, region: str, evict: bool = False) -> dict:
    if region not in REGIONS:
        raise ValueError("Unknown region")
    checkpoint = json.loads((cache / f"R{region}-complete.json").read_text())
    if checkpoint["region"] != region or not checkpoint["aggregates"]:
        raise ValueError("A completed, non-empty scientific checkpoint is required")
    extraction = owned(cache / f"R{region}-extract", cache)
    candidates = list(extraction.rglob("RPG_Parcelles.gpkg"))
    proof_path = cache / f"R{region}-source-cache.json"
    if not candidates and proof_path.exists() and not (cache / f"R{region}.7z").exists():
        existing = json.loads(proof_path.read_text())
        retained = owned(cache / f"R{region}-Parcelles.gpkg.xz", cache)
        if existing["archive_sha256"] != checkpoint["archive_sha256"] or sha256(retained) != existing["compressed_sha256"]:
            raise ValueError("Retained source provenance/checksum mismatch")
        return existing
    if len(candidates) != 1:
        if not candidates and (cache / f"R{region}-source-cache.json").exists():
            candidates = [restore(cache, region)]
        else:
            raise ValueError("Expected exactly one acquired Parcelles GeoPackage")
    source = owned(candidates[0], extraction)
    original_sha = sha256(source)
    compressed = owned(cache / f"R{region}-Parcelles.gpkg.xz", cache)
    if not compressed.exists():
        temporary = compressed.with_suffix(".xz.part")
        with source.open("rb") as inp, lzma.open(temporary, "wb", preset=3) as out:
            shutil.copyfileobj(inp, out, 1024 * 1024)
        temporary.replace(compressed)
    with lzma.open(compressed, "rb") as stream:
        if hashlib.file_digest(stream, "sha256").hexdigest() != original_sha:
            raise ValueError("Compact source copy is not byte-identical")
    archive = owned(cache / f"R{region}.7z", cache)
    # Validate every candidate before any eviction. No directory tree removal.
    if archive.exists() and sha256(archive) != checkpoint["archive_sha256"]:
        raise ValueError("Acquired archive checksum differs from completed checkpoint")
    proof = {"schema_version": "rpg-source-cache-1", "region": region,
             "source_url": checkpoint["source_url"], "archive_sha256": checkpoint["archive_sha256"],
             "gpkg_relative_path": str(source.relative_to(cache.resolve())),
             "gpkg_sha256": original_sha, "gpkg_bytes": source.stat().st_size,
             "compressed_sha256": sha256(compressed), "compressed_bytes": compressed.stat().st_size,
             "retained_content": "Complete original RPG_Parcelles.gpkg, lossless XZ; unused Ilots/SNA/ZDH delivery layers are outside the ETL scope",
             "verified_byte_identical": True}
    atomic_write(cache / f"R{region}-source-cache.json", json.dumps(proof, indent=2).encode())
    if evict:
        # These are duplicate representations of the verified retained source.
        # The retained XZ, scientific checkpoint and provenance are never removed.
        if archive.exists():
            archive.unlink()
        source.unlink()
    return proof


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=Path("work/task25"))
    parser.add_argument("--region", required=True, choices=sorted(REGIONS))
    parser.add_argument("--evict-verified-duplicates", action="store_true")
    args = parser.parse_args()
    print(json.dumps(compact(args.cache, args.region, args.evict_verified_duplicates)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
