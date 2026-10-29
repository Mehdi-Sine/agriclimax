"""Generate resumable insert-only reference SQL for the 73-PRA pilot; never connects."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
from pathlib import Path
from typing import Any

from agriclimax.territories.reference_sql import literal, reference_sql
from agriclimax.territories.spatial import Weight, load_reference
from shapely import from_wkb
from shapely.geometry import shape


def encoded_geometry(geometry: dict[str, Any]) -> str:
    """Lossless transport of original coordinates; no repair or generalization."""
    polygon = shape(geometry)
    data = polygon.wkb
    if not from_wkb(data).equals_exact(polygon, 0):
        raise ValueError("WKB roundtrip altered a source geometry")
    return (
        "ST_Multi(ST_GeomFromWKB(decode("
        + literal(base64.b64encode(data).decode())
        + ",'base64'),4326))"
    )


def prepare(bundle: Path, sample_path: Path, output: Path) -> dict[str, Any]:
    checksums = json.loads((bundle / "checksums.json").read_text())
    if set(checksums) != {
        "reference.json",
        "weights.json",
        "manifest.json",
        "source-properties.json",
    }:
        raise ValueError("Unexpected bundle members")
    for name, expected in checksums.items():
        if hashlib.sha256((bundle / name).read_bytes()).hexdigest() != expected:
            raise ValueError("Bundle checksum mismatch")
    manifest = json.loads((bundle / "manifest.json").read_text())
    sample = json.loads(sample_path.read_text())
    ids = {r["id"] for r in sample["selection"]}
    if len(ids) != 73 or sample["reference_version"] != manifest["reference_version"]:
        raise ValueError("Expected matching 73-PRA selection")
    territories, _ = load_reference(
        json.loads((bundle / "reference.json").read_text()),
        version=manifest["reference_version"],
    )
    territories = [t for t in territories if t.id in ids]
    weights = [
        Weight(**w)
        for w in json.loads((bundle / "weights.json").read_text())
        if w["pra_id"] in ids
    ]
    if len(territories) != 73:
        raise ValueError("Missing selected PRA")
    lines = reference_sql(territories, weights, manifest).splitlines()[1:-1]
    # Transport only: preserve the original reference_sql identity checks and hashes.
    for index, line in enumerate(lines):
        if line.startswith("insert into agriclimax_private.pra_territories "):
            for t in territories:
                if literal(t.id) in line[:250]:
                    old = (
                        "ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON("
                        + literal(json.dumps(t.geometry))
                        + "),4326))"
                    )
                    if old not in line:
                        raise ValueError("Unexpected reference SQL layout")
                    lines[index] = line.replace(old, encoded_geometry(t.geometry))
                    break
            else:
                raise ValueError("Unknown reference SQL row")
    output.mkdir(parents=True, exist_ok=True)
    chunks: list[list[str]] = []
    current: list[str] = []
    size = 0
    for line in lines:
        if line.startswith("set local "):
            continue
        if current and size + len(line) > 100000:
            chunks.append(current)
            current = []
            size = 0
        current.append(line)
        size += len(line)
    if current:
        chunks.append(current)
    files = []
    for index, chunk in enumerate(chunks):
        path = output / f"{index:03d}.sql"
        path.write_text(
            "begin; set local search_path=pg_catalog,public,extensions; set local statement_timeout='15s'; set local lock_timeout='3s';\n"
            + "\n".join(chunk)
            + "\ncommit;\n"
        )
        files.append(str(path))
    (output / "files.json").write_text(json.dumps(files) + "\n")
    return {
        "pra": 73,
        "weights": len(weights),
        "chunks": len(files),
        "sql_bytes": sum(Path(p).stat().st_size for p in files),
        "geometry_modified": False,
        "database_connected": False,
    }


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--bundle",
        type=Path,
        default=Path("config/coverage/ofb-masa-pra-2017-snapshot-20261017"),
    )
    p.add_argument("--sample", type=Path, default=Path("config/pilots/pra73-v1.json"))
    p.add_argument("--output", type=Path, required=True)
    a = p.parse_args()
    print(json.dumps(prepare(a.bundle, a.sample, a.output)))


if __name__ == "__main__":
    main()
