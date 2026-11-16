"""Rebuild immutable geometries from retained spatial evidence, without source grids.

Only valid cell identities, certified weights, the official reference and an
existing numeric archive are needed. No acquisition or remote publication.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path
from typing import Any

from agriclimax.territories.forecast_mask_store import save, save_index
from agriclimax.territories.forecast_masks import qualify, read_capture
from agriclimax.territories.national_daily import REFERENCE
from agriclimax.territories.spatial import Weight, load_reference
from agriclimax.territories.weather_archive import decode
from couv05_masks import VARIABLES


def rebuild(evidence: Path, archive: Path, output: Path, limit: int | None = None) -> dict[str, Any]:
    archive_raw = archive.read_bytes()
    archive_sha = hashlib.sha256(archive_raw).hexdigest()
    manifest = json.loads((evidence / "provenance.json").read_text())
    if archive_sha != manifest["archive_sha256"]:
        raise ValueError("Exact original numeric archive required")
    document = decode(archive_raw, archive_sha)
    raw_ref = (Path("config/coverage") / REFERENCE / "reference.json").read_bytes()
    if hashlib.sha256(raw_ref).hexdigest() != manifest["reference_sha256"]:
        raise ValueError("Original reference required")
    territories, _ = load_reference(json.loads(raw_ref), version=REFERENCE)
    weights = {}
    for entry in manifest["weights"]:
        raw = (evidence / entry["path"]).read_bytes()
        if hashlib.sha256(raw).hexdigest() != entry["sha256"]:
            raise ValueError("Retained native weights corrupted")
        weights[entry["model"]] = [Weight(**w) for w in json.loads(gzip.decompress(raw))["weights"]]
    proofs = []
    for entry in manifest["captures"]:
        raw = (evidence / entry["path"]).read_bytes()
        if hashlib.sha256(raw).hexdigest() != entry["sha256"]:
            raise ValueError("Retained native capture corrupted")
        proofs.extend(read_capture(raw))
    proofs.sort(key=lambda p: (["arome", "arpege", "ifs"].index(p.model), p.date, VARIABLES.index(p.variable)))
    index_raw = (evidence / manifest["native_index"]["path"]).read_bytes()
    if hashlib.sha256(index_raw).hexdigest() != manifest["native_index"]["sha256"]:
        raise ValueError("Expected native index corrupted")
    expected = {(e["model"],e["run"],e["period"],e["variable"]):e for e in json.loads(gzip.decompress(index_raw))["entries"]}
    geometry_cache: dict[tuple[Any, ...], tuple[Any, float]] = {}
    shard_cache: dict[str, dict[str, Any]] = {}
    entries = []
    for proof in proofs[:limit]:
        source = "ecmwf-open-data" if proof.model == "ifs" else "meteofrance-"+proof.model
        originals = {(r["pra_id"],r["variable"]):r for r in document["rows"]
                     if r["source_id"] == source and r["model_run_at"] == proof.run and r["valid_date"] == proof.date}
        # Compare UTC representations, not formatting, in the scientific qualifier.
        if not originals:
            from datetime import datetime
            originals = {(r["pra_id"],r["variable"]):r for r in document["rows"] if r["source_id"] == source
                         and datetime.fromisoformat(r["model_run_at"]) == datetime.fromisoformat(proof.run)
                         and r["valid_date"] == proof.date}
        result = qualify(proof, territories, weights[proof.model], aggregated=originals,
                         geometry_cache=geometry_cache, reject_invalid_geometry=True)
        entry = save(output,result,shard_cache=shard_cache)
        expected_entry = expected[proof.model,proof.run,proof.date,proof.variable]
        if entry != expected_entry:
            raise ValueError("Rebuilt spatial proof differs from retained national evidence")
        entries.append(entry)
        print(json.dumps({"model":proof.model,"day":proof.date,"variable":proof.variable,"identical":True}),flush=True)
    report: dict[str, Any] = {"identical_objects":len(entries),"source_requests":0,"source_values_retained":False}
    if limit is None:
        index = save_index(output,entries,archive_sha256=archive_sha)
        if index["sha256"] != manifest["native_index"]["sha256"]:
            raise ValueError("Rebuilt complete spatial index differs")
        report["index"] = index
    return report


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence",required=True,type=Path)
    parser.add_argument("--archive",required=True,type=Path)
    parser.add_argument("--output",required=True,type=Path)
    parser.add_argument("--limit",type=int,help="Optional bounded check; does not certify the complete index")
    args=parser.parse_args()
    print(json.dumps(rebuild(args.evidence,args.archive,args.output,args.limit),indent=2))
