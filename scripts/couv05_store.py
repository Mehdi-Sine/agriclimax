"""Prepare or upload immutable forecast-mask sidecars; never publish a pointer.

Default is an offline plan. --upload is an operator action requiring a reviewed
budget and permission; it does not activate rendering or alter any archive.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
from pathlib import Path
from typing import Any

from agriclimax.territories.forecast_mask_store import MAX_PACKED, read_document
from agriclimax.territories.forecast_masks import VERSION


def plan(root: Path, index_sha256: str, budget_bytes: int) -> dict[str, Any]:
    if not re.fullmatch("[a-f0-9]{64}", index_sha256):
        raise ValueError("Invalid spatial index checksum")
    index_path = f"forecast-masks/indexes/{index_sha256}.json.gz"
    packed = (root / index_path).read_bytes()
    if len(packed) > 1024**2 or hashlib.sha256(packed).hexdigest() != index_sha256:
        raise ValueError("Spatial index checksum/budget mismatch")
    index = json.loads(gzip.decompress(packed))
    if index.get("version") != VERSION or not re.fullmatch("[a-f0-9]{64}", index.get("archive_sha256", "")):
        raise ValueError("Invalid spatial archive binding")
    entries = index["entries"]
    if len(entries) > 200:
        raise ValueError("Spatial index entry budget exceeded")
    objects = {index_path: packed}
    total = len(packed)
    if not 0 < total <= budget_bytes:
        raise ValueError("Explicit spatial storage budget exceeded")

    def include(path: str, raw: bytes) -> None:
        nonlocal total
        if path in objects:
            if objects[path] != raw:
                raise ValueError("Immutable spatial plan conflict")
            return
        if len(raw) > MAX_PACKED or total + len(raw) > budget_bytes:
            raise ValueError("Explicit spatial storage budget exceeded")
        objects[path] = raw
        total += len(raw)

    seen = set()
    for entry in entries:
        identity = tuple(entry[k] for k in ("model", "run", "period", "variable"))
        if identity in seen:
            raise ValueError("Ambiguous spatial identity")
        seen.add(identity)
        sha = entry["sha256"]
        if not re.fullmatch("[a-f0-9]{64}", sha) or entry["path"] != f"forecast-masks/blobs/{sha}.json.gz":
            raise ValueError("Invalid spatial object path")
        raw = (root / entry["path"]).read_bytes()
        document = read_document(root, entry)
        if len(raw) != entry["bytes"] or any(document[k] != entry[k] for k in (
            "version", "model", "run", "period", "variable", "reference_sha256", "grid_version", "weights_sha256"
        )):
            raise ValueError("Spatial index/document mismatch")
        include(entry["path"], raw)
        for ref in document.get("geometry_entries", []):
            include(ref["path"], (root / ref["path"]).read_bytes())
    qualified = index.get("qualified_entries", [])
    if not isinstance(qualified, list) or len(qualified) > 512:
        raise ValueError("Invalid qualified index")
    qualified_identities = set()
    for entry in qualified:
        sha = entry["sha256"]
        path = entry["path"]
        identity = json.dumps([entry[k] for k in ("model", "run", "start", "end", "rule")], sort_keys=True)
        if identity in qualified_identities or not re.fullmatch("[a-f0-9]{64}", sha) or path != f"forecast-masks/blobs/{sha}.json.gz":
            raise ValueError("Invalid or duplicate qualified object")
        qualified_identities.add(identity)
        raw = (root / path).read_bytes()
        if len(raw) != entry["bytes"] or len(raw) > 1024**2 or hashlib.sha256(raw).hexdigest() != sha:
            raise ValueError("Qualified object integrity")
        document = json.loads(gzip.decompress(raw))
        rows = document.get("rows")
        if document.get("version") != "couv05e-qualified-1" or not isinstance(rows, list) or not 1 <= len(rows) <= 1185:
            raise ValueError("Qualified object schema")
        for row in rows:
            if row["archive_sha256"] != index["archive_sha256"] or any(row[k] != entry[k] for k in ("model", "run", "start", "end", "rule")):
                raise ValueError("Qualified object binding mismatch")
        include(path, raw)

    total = sum(len(raw) for raw in objects.values())
    if not 0 < total <= budget_bytes or any(len(raw) > MAX_PACKED for raw in objects.values()):
        raise ValueError("Explicit spatial storage budget exceeded")
    return {"index": index_path, "bytes": total, "objects": objects,
            "archive_sha256": index["archive_sha256"]}


def upload(candidate: dict[str, Any], *, retained_forecast_bytes: int | None) -> dict[str, Any]:
    from pra_weather_store import BUCKET, STORAGE_GUARD, ArchiveStore, indexed_bytes
    if retained_forecast_bytes is None or retained_forecast_bytes < 0:
        raise ValueError("Audited retained forecast-mask inventory bytes required, including orphan objects")
    store = ArchiveStore()
    buckets = json.loads(store.request("bucket"))
    if not any(b.get("id") == BUCKET and b.get("public") is False for b in buckets):
        raise ValueError("Existing private archive bucket required")
    catalogue = store.catalogue()
    if indexed_bytes(catalogue) + retained_forecast_bytes + candidate["bytes"] > STORAGE_GUARD:
        raise ValueError("Total archive storage guard exceeded")
    # Objects first, immutable snapshot last. No current.json/catalogue.json writes.
    paths = sorted(p for p in candidate["objects"] if p != candidate["index"])
    for path in [*paths, candidate["index"]]:
        store.put_immutable(path, candidate["objects"][path])
    return {"requests": store.requests, "writes": store.writes,
            "index": candidate["index"], "bytes_upper_bound": candidate["bytes"],
            "activation": False, "published_pointer_changed": False}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--index-sha256", required=True)
    parser.add_argument("--budget-bytes", required=True, type=int)
    parser.add_argument("--upload", action="store_true")
    parser.add_argument("--retained-forecast-bytes", type=int, help="Audited Storage inventory including retained/orphan forecast objects")
    args = parser.parse_args()
    candidate = plan(args.root, args.index_sha256, args.budget_bytes)
    result = upload(candidate, retained_forecast_bytes=args.retained_forecast_bytes) if args.upload else {k: v for k, v in candidate.items() if k != "objects"}
    print(json.dumps(result, indent=2))
