"""COUV-05 local candidate matrix from opt-in native-cell captures.

Offline only: no remote storage, archive mutation, or rendering activation.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from agriclimax.ingestion.storage import atomic_write
from agriclimax.territories.forecast_mask_store import decode, save, save_index
from agriclimax.territories.forecast_masks import NativeProof, qualify, read_capture
from agriclimax.territories.national_daily import REFERENCE
from agriclimax.territories.national_weather import GRID_VERSIONS
from agriclimax.territories.operational import GRID, weight_fingerprint
from agriclimax.territories.spatial import Weight, load_reference
from agriclimax.territories.weather_archive import decode as decode_archive

DAYS = {"arome": [-1, 0, 1], "arpege": [0, 1, 2, 3], "ifs": list(range(1, 8))}
VARIABLES = ["temperature", "temperature_min", "temperature_max", "precipitation", "humidity"]


def json_gzip(path: Path) -> dict[str, Any]:
    return json.loads(gzip.decompress(path.read_bytes()))


def source_weights(root: Path, model: str) -> list[Weight]:
    if model == "ifs":
        data = json.loads((root / "ifs" / "cycle.json").read_text())["weights"]
    else:
        data = json_gzip(root / f"weights-{model}.json.gz")["weights"]
    return [Weight(**v) for v in data]


def aggregate_rows(root: Path, model: str, valid: date) -> dict[tuple[str, str], dict[str, Any]]:
    if model == "ifs":
        rows = json.loads((root / "ifs" / "cycle.json").read_text())["rows"]
    else:
        candidates = list((root / "reduced").glob(f"{model}-{valid}*.json.gz"))
        if len(candidates) != 1:
            raise ValueError(f"Reduced aggregate absent or ambiguous: {model}/{valid}")
        rows = json_gzip(candidates[0])["rows"]
    matching = [r for r in rows if r["valid_date"] == str(valid)]
    if len(matching) != 713 * len(VARIABLES):
        raise ValueError("Original daily model/PRA/variable matrix is incomplete")
    return {(r["pra_id"], r["variable"]): r for r in matching}


def capture_path(root: Path, model: str, valid: date) -> Path | None:
    folder = root / ("ifs" if model == "ifs" else "") / "couv05-native"
    paths = list(folder.glob(f"{model}-{valid}*.json.gz"))
    if not paths:
        return None
    if len(paths) != 1:
        raise ValueError(f"Ambiguous native proof: {model}/{valid}")
    return paths[0]


def run(root: Path, output: Path, run_date: date, geometry: bool, archive_sha256: str | None = None, *, require_complete: bool = False, expected_run: datetime | None = None) -> dict[str, Any]:
    archive_rows: dict[tuple[str, str, str], list[dict[str, Any]]] = {}
    if require_complete and (not geometry or not archive_sha256):
        raise ValueError("Complete index requires geometry and an immutable archive")
    if archive_sha256:
        original_archive = root / "cycle.compact.json.gz"
        if not original_archive.is_file() or hashlib.sha256(original_archive.read_bytes()).hexdigest() != archive_sha256:
            raise ValueError("Exact original numeric archive required for spatial index binding")
        if require_complete:
            archive = decode_archive(original_archive.read_bytes(), archive_sha256)
            if (archive["run"][:10] != str(run_date) or archive["scope"] != "national"
                    or expected_run is not None and datetime.fromisoformat(archive["run"]) != expected_run):
                raise ValueError("Wrong national cycle for native index")
            for row in archive["rows"]:
                key = (row["source_id"], row["valid_date"], row["variable"])
                archive_rows.setdefault(key, []).append(row)

    reference = Path("config/coverage") / REFERENCE / "reference.json"
    raw = reference.read_bytes()
    territories, _ = load_reference(json.loads(raw), version=REFERENCE)
    reference_sha = hashlib.sha256(raw).hexdigest()
    territory_ids = {t.id for t in territories}
    geometry_cache: dict[tuple[Any, ...], tuple[Any, float]] = {}
    shard_cache: dict[str, dict[str, Any]] = {}
    resumed = {}
    for path in (output / "forecast-masks/blobs").glob("*.json.gz"):
        raw_cached = path.read_bytes()
        checksum = path.name.split(".")[0]
        cached = decode(raw_cached, checksum)
        if cached.get("geometry_method") == "native-wgs84-clipped-epsg3035-area-checked-1":
            key = tuple(cached[k] for k in ("model", "run", "period", "variable", "reference_sha256", "weights_sha256"))
            entry = {"path": str(path.relative_to(output)), "sha256": checksum, "bytes": len(raw_cached),
                     **{k: cached[k] for k in ("version", "model", "run", "period", "variable", "grid_version", "reference_sha256", "weights_sha256")}}
            if key in resumed:
                raise ValueError("Ambiguous resume candidate")
            resumed[key] = (cached, entry)
    entries: list[dict[str, Any]] = []
    rows: list[dict[str, Any]] = []
    import resource
    import time
    started = time.monotonic()
    stats: dict[str, Any] = {"run_date": str(run_date), "per_model": {}, "visual_verified": False, "rejections": []}
    for model, offsets in DAYS.items():
        ws = source_weights(root, model)
        if len({w.pra_id for w in ws}) != 713:
            raise ValueError("Invalid official weight identities")
        weights_sha = weight_fingerprint(ws)
        expected = frozenset(w.cell_id for w in ws)
        counts = Counter()
        for offset in offsets:
            day = run_date + timedelta(days=offset)
            path = capture_path(root, model, day)
            if path:
                proofs = {p.variable: p for p in read_capture(path.read_bytes())}
                if any(p.reference_sha256 != reference_sha or p.weights_sha256 != weights_sha or p.model != model or p.grid_version != (GRID if model == "ifs" else GRID_VERSIONS[model]) or p.date != str(day) or p.expected_cells != expected for p in proofs.values()):
                    raise ValueError(f"Captured geometry identity mismatch: {model}/{day}")
                if require_complete and set(proofs) != set(VARIABLES):
                    raise ValueError(f"Incomplete native variables: {model}/{day}")
                originals = aggregate_rows(root, model, day)
            elif require_complete:
                raise ValueError(f"Missing native proof: {model}/{day}")
            else:
                proofs = {v: NativeProof(model, "not-captured", str(day), v, "unverified",
                                         reference_sha, weights_sha, None, expected)
                          for v in VARIABLES}
                originals = None
            for variable in VARIABLES:
                p = proofs[variable]
                if require_complete:
                    source = "ecmwf-open-data" if model == "ifs" else f"meteofrance-{model}"
                    matching = archive_rows.pop((source, str(day), variable), [])
                    if (len(matching) != 713 or {r["pra_id"] for r in matching} != territory_ids
                            or any(datetime.fromisoformat(r["model_run_at"]) != datetime.fromisoformat(p.run)
                                   or r["provenance_sha256"] != p.source_sha256
                                   or r != originals[r["pra_id"], variable] for r in matching)):
                        raise ValueError(f"Native proof does not match the archive: {model}/{day}/{variable}")
                key = (model, p.run, p.date, variable, p.reference_sha256, p.weights_sha256)
                cached = resumed.get(key) if geometry else None
                if cached:
                    document, entry = cached
                    cells_by_pra: dict[str, set[str]] = {}
                    for w in ws:
                        cells_by_pra.setdefault(w.pra_id, set()).add(w.cell_id)
                    for r in document["rows"]:
                        expected_local = cells_by_pra[r["pra_id"]]
                        valid_local = None if p.valid_cells is None else sorted(expected_local & p.valid_cells)
                        if r["source_sha256"] != p.source_sha256 or set(r["expected_cells"]) != expected_local or r["valid_cells"] != valid_local:
                            raise ValueError("Resumed candidate does not match original native evidence")
                else:
                    document = qualify(proofs[variable], territories, ws, aggregated=originals,
                                   make_geometry=geometry, geometry_cache=geometry_cache,
                                       reject_invalid_geometry=True)
                stats["rejections"].extend({"model": model, "day": str(day), "variable": variable,
                    "pra_id": r["pra_id"], "reason": r["geometry_error"]}
                    for r in document["rows"] if r.get("geometry_error"))
                if geometry:
                    entries.append(entry if cached else save(output, document, shard_cache=shard_cache))
                print(json.dumps({"model": model, "day": str(day), "variable": variable,
                                  "states": dict(Counter(r["status"] for r in document["rows"]))}), flush=True)
                for r in document["rows"]:
                    r["indicator"] = variable
                    r["source"] = model
                    rows.append(r)
                    counts[r["status"]] += 1
        stats["per_model"][model] = dict(counts)
    output.mkdir(parents=True, exist_ok=True)
    path = output / "matrix.csv.gz"
    columns = ["source", "model", "run", "period", "variable", "indicator", "pra_id",
               "status", "fraction", "support_id", "reason", "native_cells", "valid_native_cells",
               "numeric_available", "geometry_verified", "grid_version", "reference_sha256",
               "weights_sha256", "pra_weights_sha256", "source_sha256"]
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    packed = gzip.compress(buffer.getvalue().encode(), mtime=0)
    atomic_write(path, packed)
    if require_complete and archive_rows:
        raise ValueError("Native index does not cover the full archive")
    if geometry and archive_sha256:
        stats["spatial_index"] = save_index(output, entries, archive_sha256=archive_sha256)
    stats["matrix_rows"] = len(rows)
    stats["matrix_sha256"] = hashlib.sha256(packed).hexdigest()
    stats["candidate_only"] = True
    stats["seconds"] = time.monotonic() - started
    stats["max_rss_kib"] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    stats["geometry_cache_entries"] = len(geometry_cache)
    stats["sidecar_bytes"] = sum(p.stat().st_size for p in (output / "forecast-masks").rglob("*") if p.is_file())
    stats["sidecar_objects"] = sum(p.is_file() for p in (output / "forecast-masks").rglob("*"))
    stats["activation"] = "NO-GO"
    atomic_write(output / "summary.json", json.dumps(stats, indent=2).encode())
    return stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--run-date", type=date.fromisoformat, required=True)
    parser.add_argument("--geometry", action="store_true")
    parser.add_argument("--archive-sha256", help="Exact immutable numeric archive binding; never moves a pointer")
    args = parser.parse_args()
    print(json.dumps(run(args.root, args.output, args.run_date, args.geometry, args.archive_sha256), indent=2))
