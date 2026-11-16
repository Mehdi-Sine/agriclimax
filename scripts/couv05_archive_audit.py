"""Offline exhaustive availability audit. Aggregate archives never prove native geometry."""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import resource
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from agriclimax.ingestion.storage import atomic_write
from agriclimax.territories.national_daily import REFERENCE
from agriclimax.territories.weather_archive import decode


def audit(archive: Path, output: Path) -> dict[str, Any]:
    started = time.monotonic()
    packed = archive.read_bytes()
    sha = hashlib.sha256(packed).hexdigest()
    document = decode(packed, sha)
    rows = document["rows"]
    ref_raw = (Path("config/coverage") / REFERENCE / "reference.json").read_bytes()
    reference = json.loads(ref_raw)
    ids = {"pra:" + f["properties"]["code"] for f in reference["features"]}
    corsica = {"pra:" + f["properties"]["code"] for f in reference["features"]
               if f["properties"]["department"] in {"2A", "2B"}}
    if len(ids) != 713 or len(corsica) != 6 or {r["pra_id"] for r in rows} != ids:
        raise ValueError("Official national reference mismatch")
    identities = [(r["model"], r["model_run_at"], r["valid_date"], r["variable"], r["pra_id"]) for r in rows]
    if len(set(identities)) != len(rows):
        raise ValueError("Ambiguous archive identities")
    output.mkdir(parents=True, exist_ok=True)
    counts: Counter[str] = Counter()
    native_counts: dict[str, Counter[str]] = defaultdict(Counter)
    fields = ["model", "run", "start", "end", "indicator", "variables", "pra_id", "status",
              "fraction", "support_id", "numeric_available", "reason", "archive_sha256"]
    groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        groups[row["model"], row["model_run_at"]].append(row)
    catalogue_path = Path("docs/codex/AGRO-03/evidence/catalogue.json")
    catalogue_raw = catalogue_path.read_bytes()
    recipes = json.loads(catalogue_raw)["recipes"]
    with gzip.GzipFile(filename=str(output / "archive-matrix.csv.gz"), mode="wb", mtime=0) as compressed:
        import io
        with io.TextIOWrapper(compressed, encoding="utf-8", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=fields)
            writer.writeheader()
            for row in rows:
                numeric = row["value"] is not None and row["status"] != "unavailable"
                writer.writerow({"model": row["model"], "run": row["model_run_at"], "start": row["valid_date"],
                                     "end": row["valid_date"], "indicator": row["variable"], "variables": row["variable"],
                                     "pra_id": row["pra_id"], "status": "unknown", "fraction": "", "support_id": "",
                                     "numeric_available": str(numeric).lower(), "reason": "native_proof_not_archived",
                                     "archive_sha256": sha})
                native_counts[row["model"]]["rows"] += 1
                native_counts[row["model"]]["numeric_available"] += int(numeric)
                counts["native"] += 1
            for (model, run), group in sorted(groups.items()):
                dates = sorted({r["valid_date"] for r in group})
                for i, start in enumerate(dates):
                    for end in dates[i:]:
                        for recipe in recipes:
                            for pra in sorted(ids):
                                writer.writerow({"model": model, "run": run, "start": start, "end": end,
                                                     "indicator": recipe["id"], "variables": "+".join(recipe["kernel"]["variables"]),
                                                     "pra_id": pra, "status": "unknown", "fraction": "", "support_id": "",
                                                     "numeric_available": "not_evaluated", "reason": "common_native_support_not_archived",
                                                     "archive_sha256": sha})
                                counts["recipe"] += 1
    matrix = (output / "archive-matrix.csv.gz").read_bytes()
    report = {"verdict": "PARTIAL / NO-GO activation", "archive_sha256": sha,
              "archive_bytes": len(packed), "reference_sha256": hashlib.sha256(ref_raw).hexdigest(),
              "recipe_catalogue_sha256": hashlib.sha256(catalogue_raw).hexdigest(),
              "pra": len(ids), "corsica": sorted(corsica), "native": dict(native_counts),
              "matrix_rows": sum(counts.values()), "matrix_sections": dict(counts),
              "matrix_sha256": hashlib.sha256(matrix).hexdigest(), "matrix_bytes": len(matrix),
              "recipes": len(recipes), "spatial_states": {"unknown": sum(counts.values()),
              "absent": 0, "partial": 0, "demonstrated": 0},
              "numeric_recipes": "not evaluated; spatial audit does not change scientific formulae",
              "geometry_validation": "not demonstrated by aggregate archive alone; consult native-summary.json",
              "visual_validation": "archive-only diagnostic; external native proofs intentionally not consulted",
              "remote_acquisitions": 0, "remote_writes": 0,
              "seconds": time.monotonic() - started,
              "max_rss_kib": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}
    atomic_write(output / "archive-audit.json", json.dumps(report, indent=2).encode())
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(audit(args.archive, args.output), indent=2))
