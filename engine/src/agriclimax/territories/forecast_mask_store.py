"""Content-addressed spatial sidecars. No mutable archive pointer or numeric grid."""
from __future__ import annotations

import gzip
import hashlib
import io
import json
import re
from pathlib import Path
from typing import Any

from agriclimax.news.batch import immutable_write

from .forecast_masks import VERSION

MAX_PACKED = 8 * 1024**2
MAX_DECODED = 64 * 1024**2


def encode(document: dict[str, Any]) -> bytes:
    validate(document)
    raw = json.dumps(document, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    if len(raw) > MAX_DECODED:
        raise ValueError("Spatial sidecar decoded budget exceeded")
    packed = gzip.compress(raw, mtime=0)
    if len(packed) > MAX_PACKED:
        raise ValueError("Spatial sidecar object budget exceeded")
    return packed


def validate(document: dict[str, Any]) -> None:
    if document.get("version") != VERSION:
        raise ValueError("Unsupported spatial sidecar version")
    rows = document.get("rows", [])
    if len(rows) != 713 or len({r["pra_id"] for r in rows}) != 713:
        raise ValueError("713 unique PRA rows required")
    by_id = {r["pra_id"]: r for r in rows}
    for row in rows:
        if any(row[k] != document[k] for k in ("model", "run", "period", "variable", "grid_version",
                                               "reference_sha256", "weights_sha256")):
            raise ValueError("Spatial row/document identity mismatch")
        expected, valid = row["expected_cells"], row["valid_cells"]
        if len(set(expected)) != len(expected) or len(expected) != row["native_cells"]:
            raise ValueError("Invalid expected PRA cells")
        if valid is not None and (len(set(valid)) != len(valid) or not set(valid) <= set(expected)
                                  or len(valid) != row["valid_native_cells"]):
            raise ValueError("Invalid qualified PRA cells")
    features = document.get("collection", {}).get("features", [])
    if len({f["id"] for f in features}) != len(features):
        raise ValueError("Duplicate spatial feature")
    for feature in features:
        from shapely.geometry import shape
        polygon = shape(feature["geometry"])
        if polygon.is_empty or not polygon.is_valid or polygon.geom_type not in {"Polygon", "MultiPolygon"}:
            raise ValueError("Invalid persisted native geometry")
        if feature["id"] != "pra:" + feature["properties"]["code"]:
            raise ValueError("Spatial feature PRA code mismatch")
        row = by_id.get(feature["id"])
        if not row or not row.get("geometry_verified") or feature["properties"].get("support_id") != row["support_id"]:
            raise ValueError("Spatial feature identity mismatch")
    feature_ids = {f["id"] for f in features}
    refs = document.get("geometry_entries", [])
    referenced: list[str] = []
    for ref in refs:
        if not re.fullmatch("[a-f0-9]{64}", ref["sha256"]) or ref["path"] != f'forecast-masks/geometries/{ref["sha256"]}.json.gz' or not 0 < ref["bytes"] <= MAX_PACKED:
            raise ValueError("Invalid immutable geometry reference")
        referenced.extend(ref["pra_ids"])
    if len(referenced) != len(set(referenced)):
        raise ValueError("Ambiguous geometry reference")
    if refs and set(referenced) != {r["pra_id"] for r in rows if r["status"] in {"partial", "demonstrated"}}:
        raise ValueError("Incomplete immutable geometry references")
    if not features:
        feature_ids.update(referenced)
    for row in rows:
        if row["status"] not in {"demonstrated", "partial", "unknown", "absent"}:
            raise ValueError("Invalid spatial qualification")
        if row["status"] == "unknown":
            if row["support_id"] is not None:
                raise ValueError("Unknown support cannot be identified as qualified")
            continue
        if not re.fullmatch("[a-f0-9]{64}", row.get("support_id") or ""):
            raise ValueError("Invalid qualified support identity")
        if row["status"] in {"demonstrated", "partial"} and (
            not row.get("geometry_verified") or row["pra_id"] not in feature_ids
        ):
            raise ValueError("Positive spatial proof requires verified geometry, including >=90%")


def decode(raw: bytes, checksum: str) -> dict[str, Any]:
    if not re.fullmatch("[a-f0-9]{64}", checksum) or len(raw) > MAX_PACKED or hashlib.sha256(raw).hexdigest() != checksum:
        raise ValueError("Spatial sidecar checksum/budget mismatch")
    with gzip.GzipFile(fileobj=io.BytesIO(raw)) as stream:
        expanded = stream.read(MAX_DECODED + 1)
    if len(expanded) > MAX_DECODED:
        raise ValueError("Spatial sidecar decoded budget exceeded")
    document: dict[str, Any] = json.loads(expanded)
    validate(document)
    return document


def geometry_blob(raw: bytes, checksum: str) -> dict[str, Any]:
    if len(raw) > MAX_PACKED or hashlib.sha256(raw).hexdigest() != checksum:
        raise ValueError("Geometry shard checksum/budget mismatch")
    with gzip.GzipFile(fileobj=io.BytesIO(raw)) as stream:
        expanded = stream.read(MAX_DECODED + 1)
    if len(expanded) > MAX_DECODED:
        raise ValueError("Geometry shard decoded budget exceeded")
    value: dict[str, Any] = json.loads(expanded)
    if value.get("version") != VERSION or value.get("type") != "FeatureCollection":
        raise ValueError("Invalid geometry shard")
    return value


def read_document(root: Path, entry: dict[str, Any]) -> dict[str, Any]:
    document = decode((root / entry["path"]).read_bytes(), entry["sha256"])
    by_id = {r["pra_id"]: r for r in document["rows"]}
    for ref in document.get("geometry_entries", []):
        raw = (root / ref["path"]).read_bytes()
        if len(raw) != ref["bytes"]:
            raise ValueError("Geometry shard size mismatch")
        shard = geometry_blob(raw, ref["sha256"])
        if sorted(f["id"] for f in shard["features"]) != ref["pra_ids"]:
            raise ValueError("Geometry shard PRA identity mismatch")
        for feature in shard["features"]:
            feature["properties"]["support_id"] = by_id[feature["id"]]["support_id"]
            document["collection"]["features"].append(feature)
    validate(document)
    return document


def save(root: Path, document: dict[str, Any], *, shard_cache: dict[str, dict[str, Any]] | None = None) -> dict[str, Any]:
    validate(document)  # All actual polygons must be present before sharding.
    if document.get("geometry_entries"):
        raise ValueError("Producer requires complete original qualified geometries")
    by_id = {f["id"]: f for f in document["collection"]["features"]}
    refs = []
    ids = sorted(r["pra_id"] for r in document["rows"])
    for offset in range(0, len(ids), 64):
        features = [{**by_id[pra], "properties": {k: v for k, v in by_id[pra]["properties"].items()
                    if k != "support_id"}} for pra in ids[offset:offset+64] if pra in by_id]
        if not features:
            continue
        body = json.dumps({"version": VERSION, "type": "FeatureCollection", "features": features},
                          sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
        body_sha = hashlib.sha256(body).hexdigest()
        cached = shard_cache.get(body_sha) if shard_cache is not None else None
        if cached is not None and (root / cached["path"]).exists():
            refs.append(cached)
            continue
        raw = gzip.compress(body, mtime=0)
        if len(raw) > MAX_PACKED or len(body) > MAX_DECODED:
            raise ValueError("Geometry shard budget exceeded")
        sha = hashlib.sha256(raw).hexdigest()
        path = f"forecast-masks/geometries/{sha}.json.gz"
        immutable_write(root / path, raw)
        ref = {"path": path, "sha256": sha, "bytes": len(raw),
               "pra_ids": sorted(f["id"] for f in features)}
        refs.append(ref)
        if shard_cache is not None:
            shard_cache[body_sha] = ref
    metadata = {**document, "collection": {"type": "FeatureCollection", "features": []},
                "geometry_entries": refs}
    packed = encode(metadata)
    checksum = hashlib.sha256(packed).hexdigest()
    path = f"forecast-masks/blobs/{checksum}.json.gz"
    immutable_write(root / path, packed)
    decode((root / path).read_bytes(), checksum)
    return {"path": path, "sha256": checksum, "bytes": len(packed),
            **{k: document[k] for k in ("version", "model", "run", "period", "variable",
                                       "grid_version", "reference_sha256", "weights_sha256")}}


def save_index(root: Path, entries: list[dict[str, Any]], *, archive_sha256: str) -> dict[str, Any]:
    if not re.fullmatch("[a-f0-9]{64}", archive_sha256):
        raise ValueError("Exact numeric archive checksum required")
    identities = [(e["model"], e["run"], e["period"], e["variable"]) for e in entries]
    if len(set(identities)) != len(entries):
        raise ValueError("Ambiguous spatial index")
    for entry in entries:
        if entry["path"] != f'forecast-masks/blobs/{entry["sha256"]}.json.gz':
            raise ValueError("Invalid spatial object path")
        document = read_document(root, entry)
        if any(document[k] != entry[k] for k in ("version", "model", "run", "period", "variable",
                                                "grid_version", "reference_sha256", "weights_sha256")):
            raise ValueError("Spatial index identity mismatch")
    packed = gzip.compress(json.dumps({"version": VERSION, "archive_sha256": archive_sha256, "entries": entries}, sort_keys=True,
                                     separators=(",", ":")).encode(), mtime=0)
    checksum = hashlib.sha256(packed).hexdigest()
    path = f"forecast-masks/indexes/{checksum}.json.gz"
    immutable_write(root / path, packed)
    return {"path": path, "sha256": checksum, "bytes": len(packed)}
