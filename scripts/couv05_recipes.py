"""Offline recipe intersections. Reuse a geometry only for an identical native cell set.

Numeric recipes are deliberately not recalculated from PRA aggregates. New common
cell sets without a certified geometry remain unknown and are reported explicitly.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import time
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from agriclimax.territories.forecast_mask_store import decode
from agriclimax.territories.forecast_masks import (
    combine_required,
    read_capture,
    support_identity,
)
from agriclimax.territories.operational import weight_fingerprint
from couv05_masks import source_weights


def run(captures: Path, sidecars: Path, output: Path) -> dict[str, Any]:
    started = time.monotonic()
    proofs = {}
    for path in [*(captures / "couv05-native").glob("*.gz"), *(captures / "ifs/couv05-native").glob("*.gz")]:
        for proof in read_capture(path.read_bytes()):
            key = (proof.model, proof.run, proof.date, proof.variable)
            if key in proofs:
                raise ValueError("Ambiguous native recipe input")
            proofs[key] = proof
    weights = {model: source_weights(captures, model) for model in ("arome", "arpege", "ifs")}
    weight_shas = {model:weight_fingerprint(ws) for model,ws in weights.items()}
    groups: dict[str, dict[str, list[Any]]] = {model: defaultdict(list) for model in weights}
    for model, ws in weights.items():
        for w in ws:
            groups[model][w.pra_id].append(w)
    certified = {}
    summary = json.loads((sidecars / "summary.json").read_text())
    index_ref = summary["spatial_index"]
    raw_index = (sidecars / index_ref["path"]).read_bytes()
    if hashlib.sha256(raw_index).hexdigest() != index_ref["sha256"]:
        raise ValueError("Recipe spatial index checksum mismatch")
    index = json.loads(gzip.decompress(raw_index))
    for entry in index["entries"]:
        document = decode((sidecars / entry["path"]).read_bytes(), entry["sha256"])
        refs = {pra: ref["sha256"] for ref in document.get("geometry_entries", []) for pra in ref["pra_ids"]}
        for row in document["rows"]:
            if row["geometry_verified"] and row["pra_id"] in refs:
                key = (row["model"], row["reference_sha256"], row["weights_sha256"], row["grid_version"], row["pra_id"], tuple(row["valid_cells"]))
                certified[key] = refs[row["pra_id"]]
    catalogue = json.loads(Path("docs/codex/AGRO-03/evidence/catalogue.json").read_text())
    cycles: dict[tuple[str, str], set[str]] = defaultdict(set)
    for model, cycle, day, _ in proofs:
        cycles[model, cycle].add(day)
    output.mkdir(parents=True, exist_ok=True)
    counts: Counter[str] = Counter()
    columns = ["model", "run", "start", "end", "indicator", "pra_id", "status", "fraction",
               "native_intersection_fraction", "numeric_available", "support_id", "geometry_sha256",
               "input_sha256", "cellset_sha256", "reason"]
    with (
        gzip.GzipFile(filename=str(output / "recipe-matrix.csv.gz"), mode="wb", mtime=0) as packed,
        io.TextIOWrapper(packed, encoding="utf-8", newline="") as stream,
    ):
        writer = csv.DictWriter(stream, fieldnames=columns)
        writer.writeheader()
        for (model, cycle), days in sorted(cycles.items()):
            dates = sorted(days)
            for i, first in enumerate(dates):
                for last in dates[i:]:
                    window = [str(date.fromisoformat(first) + timedelta(days=d))
                              for d in range((date.fromisoformat(last)-date.fromisoformat(first)).days+1)]
                    if any(d not in days for d in window):
                        continue
                    for recipe in catalogue["recipes"]:
                        variables = recipe["kernel"]["variables"]
                        required = [proofs[model, cycle, day, variable] for day in window for variable in variables]
                        common = combine_required(required, indicator=catalogue["version"]+"/"+recipe["id"]+"/"+hashlib.sha256(json.dumps(recipe,sort_keys=True).encode()).hexdigest(),
                                                  variables=variables, start=first, end=last)
                        if common.weights_sha256 != weight_shas[model]:
                            raise ValueError("Recipe weights differ from certified native grid")
                        input_sha = hashlib.sha256(json.dumps(common.inputs).encode()).hexdigest()
                        for pra, ws in sorted(groups[model].items()):
                            valid = sorted(w.cell_id for w in ws if common.valid_cells is not None and w.cell_id in common.valid_cells)
                            import math
                            valid_set = set(valid)
                            fraction = min(1.0, math.fsum(w.weight for w in ws if w.cell_id in valid_set))
                            geometry = certified.get((model, common.reference_sha256, common.weights_sha256, common.grid_version, pra, tuple(valid)))
                            known = common.valid_cells is not None and (not valid or geometry is not None)
                            status = ("unknown" if not known else "absent" if not valid else "demonstrated" if fraction >= .9 else "partial")
                            writer.writerow({"model":model,"run":cycle,"start":first,"end":last,
                              "indicator":recipe["id"],"pra_id":pra,"status":status,"fraction":fraction if known else None,
                              "native_intersection_fraction":fraction,"numeric_available":"not_evaluated",
                              "support_id":support_identity(common,pra,ws,valid) if known else None,
                              "geometry_sha256":geometry,"input_sha256":input_sha,
                              "cellset_sha256":hashlib.sha256(json.dumps(valid).encode()).hexdigest(),
                              "reason":"exact_native_intersection_certified" if known else "new_common_geometry_not_certified"})
                            counts[status] += 1
    raw = (output / "recipe-matrix.csv.gz").read_bytes()
    report = {"rows":sum(counts.values()),"statuses":dict(counts),"recipes":len(catalogue["recipes"]),
              "matrix_sha256":hashlib.sha256(raw).hexdigest(),"matrix_bytes":len(raw),
              "seconds":time.monotonic()-started,"numeric_recipes":"not evaluated", "activation":False,
              "geometry_reuse":"only identical per-PRA native cell membership; new support_id per recipe/period/inputs",
              "source_requests":0}
    (output / "recipes.json").write_text(json.dumps(report,indent=2))
    return report


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--captures",required=True,type=Path)
    parser.add_argument("--sidecars",required=True,type=Path)
    parser.add_argument("--output",required=True,type=Path)
    args=parser.parse_args()
    print(json.dumps(run(args.captures,args.sidecars,args.output),indent=2))
