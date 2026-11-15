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
from dataclasses import asdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from agriclimax.territories.forecast_masks import NativeProof, qualify, read_capture
from agriclimax.territories.national_daily import REFERENCE
from agriclimax.territories.operational import weight_fingerprint
from agriclimax.territories.spatial import Weight, load_reference
from agriclimax.ingestion.storage import atomic_write

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


def run(root: Path, output: Path, run_date: date, geometry: bool) -> dict[str, Any]:
    reference = Path("config/coverage") / REFERENCE / "reference.json"
    raw = reference.read_bytes()
    territories, _ = load_reference(json.loads(raw), version=REFERENCE)
    reference_sha = hashlib.sha256(raw).hexdigest()
    rows: list[dict[str, Any]] = []
    stats: dict[str, Any] = {"run_date": str(run_date), "per_model": {}, "visual_verified": False}
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
                if any(p.reference_sha256 != reference_sha or p.weights_sha256 != weights_sha or p.model != model or p.date != str(day) or p.expected_cells != expected for p in proofs.values()):
                    raise ValueError(f"Captured geometry identity mismatch: {model}/{day}")
                originals = aggregate_rows(root, model, day)
            else:
                proofs = {v: NativeProof(model, "not-captured", str(day), v, "unverified",
                                         reference_sha, weights_sha, None, expected)
                          for v in VARIABLES}
                originals = None
            for variable in VARIABLES:
                document = qualify(proofs[variable], territories, ws, aggregated=originals,
                                   make_geometry=geometry)
                if geometry and document["collection"]["features"]:
                    target = output / "candidate-geometries" / model / str(day)
                    target.mkdir(parents=True, exist_ok=True)
                    body = gzip.compress(json.dumps(document["collection"],
                                    separators=(",", ":")).encode(), mtime=0)
                    atomic_write(target / f"{variable}.geojson.gz", body)
                for r in document["rows"]:
                    r["indicator"] = variable
                    r["source"] = model
                    rows.append(r)
                    counts[r["status"]] += 1
        stats["per_model"][model] = dict(counts)
    output.mkdir(parents=True, exist_ok=True)
    path = output / "matrix.csv.gz"
    columns = ["source", "model", "run", "period", "variable", "indicator", "pra_id",
               "status", "fraction", "support_id", "reason", "native_cells", "valid_native_cells"]
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=columns)
    writer.writeheader()
    writer.writerows(rows)
    packed = gzip.compress(buffer.getvalue().encode(), mtime=0)
    atomic_write(path, packed)
    stats["matrix_rows"] = len(rows)
    stats["matrix_sha256"] = hashlib.sha256(packed).hexdigest()
    stats["candidate_only"] = True
    stats["activation"] = "NO-GO"
    atomic_write(output / "summary.json", json.dumps(stats, indent=2).encode())
    return stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--run-date", type=date.fromisoformat, required=True)
    parser.add_argument("--geometry", action="store_true")
    args = parser.parse_args()
    print(json.dumps(run(args.root, args.output, args.run_date, args.geometry), indent=2))
