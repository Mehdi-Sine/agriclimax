"""Offline inspection of an actual canary; never infer national daily coverage."""
from __future__ import annotations

import argparse
import csv
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any

from agriclimax.climate.national_support import from_sim, qualify
from agriclimax.climate.safran_incremental import CandidateStore, serialized


def review(root: Path, output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    store = CandidateStore(root)
    # Mixed CSV evidence fields are serialized only; scientific rows stay typed.
    matrix: list[dict[str, Any]] = []
    quality: Counter[str] = Counter()
    for text in sorted(store.index()["days"]):
        for row in store.read(date.fromisoformat(text)):
            if row["variable"] not in {"temperature_mean", "precipitation"}:
                continue
            result = qualify(from_sim(row))
            assert not result["quality"]["journal_eligible"]
            assert not result["quality"]["indicator_eligible"]
            quality.update(row["quality_flags"])
            matrix.append({"date": text, "pra_id": row["pra_id"], "variable": row["variable"],
                           "usable_at_90": result["usable"],
                           "represented_value": result["value"] if result["value"] is not None
                           else result["observed_value"], "unit": row["unit"],
                           "spatial_coverage": row["spatial_coverage"],
                           "temporal_coverage": row["temporal_coverage"],
                           "period": row["period"], "state": result["quality"]["state"],
                           "source_sha256": row["provenance"], "support_id": row["support_id"],
                           "rule_version": row["rule_version"],
                           "data_freshness": row["data_freshness"]})
    with (output / "coverage.csv").open("w") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(matrix[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(matrix)
    summary: dict[str, Any] = {"scope": "32 targeted PRA only; no national daily coverage claim",
               "quality_flags": dict(quality), "dates": sorted(store.index()["days"]),
               "variables": {}}
    for variable in ["temperature_mean", "precipitation"]:
        selected = [r for r in matrix if r["variable"] == variable]
        summary["variables"][variable] = {
            "pra_count": len({r["pra_id"] for r in selected}),
            "pra_days": len(selected), "usable_pra_days": sum(r["usable_at_90"] for r in selected),
            "minimum_spatial_coverage": min(r["spatial_coverage"] for r in selected),
            "minimum_temporal_coverage": min(r["temporal_coverage"] for r in selected),
            "min_value": min(r["represented_value"] for r in selected),
            "max_value": max(r["represented_value"] for r in selected),
            "by_date": {text: sum(r["usable_at_90"] for r in selected if r["date"] == text)
                        for text in summary["dates"]}}
    (output / "coverage-summary.json").write_bytes(serialized(summary))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    review(args.root, args.output)
