"""Bounded read-only SAFRAN pilot: official discovery, immutable local daily archives.

No database client, remote publication, background task, or operational workflow.
The data.gouv Parquet is a mediated transport: preserve its identity and verify a
bounded prefix independently against the Météo-France gzip, never claim a full
bytewise equivalence of both files.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import resource
import signal
import time
import urllib.request
from collections import Counter, defaultdict
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq
from agriclimax.climate.safran import (
    METHOD,
    VARIABLES,
    CellWeight,
    aggregate,
    cell_id,
    reduce_window,
)
from agriclimax.territories.weather_archive import decode, encode
from pyproj import Transformer
from shapely.geometry import box, shape
from shapely.ops import transform
from shapely.strtree import STRtree

CATALOGUE = "https://www.data.gouv.fr/api/1/datasets/6569b27598256cc583c917a7/"
REFERENCE = Path("config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json")
FILE_LIMIT = 16 * 1024**2
TOTAL_LIMIT = 128 * 1024**2
WORKSPACE_LIMIT = 448 * 1024**2


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def serialized(value: object) -> bytes:
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), allow_nan=False
    ).encode()


def immutable(path: Path, raw: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_bytes() != raw:
            raise ValueError(f"Immutable checkpoint conflict: {path.name}")
        return
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_bytes(raw)
    temporary.replace(path)


class Acquisition:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.calls = 0
        self.bytes = 0

    def get(self, name: str, url: str) -> Path:
        path = self.root / name
        receipt = path.with_suffix(path.suffix + ".receipt.json")
        if path.exists() and receipt.exists():
            if sha(path.read_bytes()) != json.loads(receipt.read_bytes())["sha256"]:
                raise ValueError("Cached source checksum mismatch")
            return path
        if self.calls >= 128 or self.bytes + FILE_LIMIT > TOTAL_LIMIT:
            raise ValueError("Existing acquisition budget exhausted")
        with urllib.request.urlopen(url, timeout=45) as response:
            if int(response.headers.get("Content-Length", "0")) > FILE_LIMIT:
                raise ValueError("Source exceeds existing 16MiB per-file budget")
            raw = response.read(FILE_LIMIT + 1)
            headers = {
                k: response.headers.get(k)
                for k in ["ETag", "Last-Modified", "Content-Length"]
            }
        self.calls += 1
        self.bytes += len(raw)
        if len(raw) > FILE_LIMIT:
            raise ValueError("Source exceeds existing per-file budget")
        used = sum(p.stat().st_size for p in self.root.rglob("*") if p.is_file())
        if used + len(raw) > WORKSPACE_LIMIT:
            raise ValueError("Existing workspace budget exhausted")
        immutable(path, raw)
        immutable(
            receipt,
            serialized(
                {
                    "url": url,
                    "sha256": sha(raw),
                    "bytes": len(raw),
                    "acquired_at": datetime.now(UTC).isoformat(),
                    "headers": headers,
                }
            ),
        )
        return path


def acquire(root: Path) -> dict[str, int]:
    fetch = Acquisition(root)
    catalog = json.loads(fetch.get("catalogue.json", CATALOGUE).read_bytes())
    latest = next(r for r in catalog["resources"] if r["title"] == "QUOT_SIM2_latest")
    url = latest["extras"]["analysis:parsing:parquet_url"]
    if not url.startswith("https://hydra.s3.rbx.io.cloud.ovh.net/parquet/"):
        raise ValueError("Unexpected data.gouv mediated transport origin")
    fetch.get("latest.parquet", url)
    for title in [
        "coordonnees_grille_safran_lambert-2-etendu.csv",
        "SIM2.prj",
        "SIM_QUOTIDIENNE_parametres.pdf",
        "SIM_Presentation_modele_SIM.pdf",
    ]:
        entry = next(r for r in catalog["resources"] if r["title"] == title)
        fetch.get(title, entry["url"])
    return {"source_calls": fetch.calls, "source_bytes": fetch.bytes}


def build_weights(
    root: Path,
) -> tuple[dict[str, list[CellWeight]], list[dict[str, Any]], dict[str, Any]]:
    """Shapely/GeoJSON boundary objects are dynamically typed; science uses typed weights."""
    coordinates = list(
        csv.DictReader(
            (root / "coordonnees_grille_safran_lambert-2-etendu.csv")
            .read_text()
            .splitlines(),
            delimiter=";",
        )
    )
    ids = [cell_id(float(r["LAMBX (hm)"]), float(r["LAMBY (hm)"])) for r in coordinates]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate grid centres")
    project = Transformer.from_crs(27572, 3035, always_xy=True)
    cells = [
        transform(
            project.transform,
            box(
                float(r["LAMBX (hm)"]) * 100 - 4000,
                float(r["LAMBY (hm)"]) * 100 - 4000,
                float(r["LAMBX (hm)"]) * 100 + 4000,
                float(r["LAMBY (hm)"]) * 100 + 4000,
            ).segmentize(1000),
        )
        for r in coordinates
    ]
    tree = STRtree(cells)
    document = json.loads(REFERENCE.read_bytes())
    features = document["features"]
    if len(features) != 713 or len({f["properties"]["code"] for f in features}) != 713:
        raise ValueError("Exactly 713 official PRA required")
    if sum(f["properties"]["department"] in {"2A", "2B"} for f in features) != 6:
        raise ValueError("Exactly six Corsican PRA required")
    p = Transformer.from_crs(4326, 3035, always_xy=True)
    weights = {}
    records = []
    for f in features:
        polygon = shape(f["geometry"])
        if not polygon.is_valid:
            raise ValueError("Official geometry invalid; no automatic repair")
        polygon = transform(p.transform, polygon)
        pra = "pra:" + f["properties"]["code"]
        pairs = []
        for i in sorted(
            tree.query(polygon, predicate="intersects"), key=lambda i: ids[i]
        ):
            area = polygon.intersection(cells[i]).area
            if area > 0.01:
                pairs.append(CellWeight(ids[i], area / polygon.area))
                records.append(
                    {
                        "pra_id": pra,
                        "cell_id": ids[i],
                        "weight": area / polygon.area,
                        "intersection_m2": area,
                        "pra_area_m2": polygon.area,
                    }
                )
        weights[pra] = pairs
    differences = {}
    for crs in [4326, 4275]:
        t = Transformer.from_crs(27572, crs, always_xy=True)
        delta = []
        for r in coordinates:
            lon, lat = t.transform(
                float(r["LAMBX (hm)"]) * 100, float(r["LAMBY (hm)"]) * 100
            )
            delta.append(
                max(
                    abs(lon - float(r["LON_DG"].replace(",", "."))),
                    abs(lat - float(r["LAT_DG"].replace(",", "."))),
                )
            )
        differences[str(crs)] = {
            "max_degree": max(delta),
            "mean_degree": sum(delta) / len(delta),
        }
    return (
        weights,
        features,
        {
            "grid_cells": len(ids),
            "intersections": len(records),
            "records": records,
            "coordinate_diagnostics": differences,
            "reference_sha256": sha(REFERENCE.read_bytes()),
            "grid_sha256": sha(
                (root / "coordonnees_grille_safran_lambert-2-etendu.csv").read_bytes()
            ),
            "method": METHOD,
            "area_crs": "EPSG:3035",
            "native_crs": "EPSG:27572",
            "densification_m": 1000,
            "footprint": "8000m squares centred on official hm coordinates",
        },
    )


def pilot(root: Path, output: Path) -> dict[str, object]:
    started = time.monotonic()
    weights, features, support = build_weights(root)
    support_raw = serialized(support)
    support_sha = sha(support_raw)
    immutable(output / "weights.json.gz", gzip.compress(support_raw, mtime=0))
    source = root / "latest.parquet"
    source_sha = sha(source.read_bytes())
    catalog = json.loads((root / "catalogue.json").read_bytes())
    resource_entry = next(
        r for r in catalog["resources"] if r["title"] == "QUOT_SIM2_latest"
    )
    freshness = resource_entry["extras"]["analysis:last-modified-at"]
    # Only these columns are materialized, never all soil/energy fields.
    columns = [
        "LAMBX",
        "LAMBY",
        "DATE",
        *sorted({f for v in VARIABLES.values() for f in v.fields}),
    ]
    by_day: dict[date, dict[str, dict[str, object]]] = defaultdict(dict)
    for batch in pq.ParquetFile(source).iter_batches(batch_size=20000, columns=columns):
        for row in batch.to_pylist():
            day = row.pop("DATE")
            cid = cell_id(row.pop("LAMBX"), row.pop("LAMBY"))
            if cid in by_day[day]:
                raise ValueError("Duplicate source cell/date")
            by_day[day][cid] = row
    days = sorted(by_day)
    if (
        not days
        or len(days) > 60
        or days != [days[0] + timedelta(days=i) for i in range(len(days))]
    ):
        raise ValueError(
            "Latest source dates must be continuous and at most sixty days"
        )
    expected_cells = {
        cell_id(float(r["LAMBX (hm)"]), float(r["LAMBY (hm)"]))
        for r in csv.DictReader(
            (root / "coordonnees_grille_safran_lambert-2-etendu.csv")
            .read_text()
            .splitlines(),
            delimiter=";",
        )
    }
    if any(set(rows) != expected_cells for rows in by_day.values()):
        raise ValueError(
            "Source date/grid identity differs from official coordinate catalogue"
        )
    names = {"pra:" + f["properties"]["code"]: f["properties"] for f in features}
    snapshots = output / "snapshots" / source_sha
    manifest = {
        "method": METHOD,
        "source_sha256": source_sha,
        "support_sha256": support_sha,
        "source_resource": resource_entry,
        "days": [],
    }
    counts: dict[str, Counter[str]] = {v: Counter() for v in VARIABLES}
    windows: dict[tuple[str, str], list[Any]] = defaultdict(list)
    last_rows = []
    matrix_buffer = io.StringIO()
    fieldnames = [
        "pra_id",
        "region",
        "region_name",
        "date",
        "variable",
        "nature",
        "source",
        "model",
        "support_id",
        "spatial_coverage",
        "temporal_coverage",
        "state",
        "value",
        "partial_value",
        "unit",
        "period",
        "scientific_validation",
        "reason",
    ]
    writer = csv.DictWriter(matrix_buffer, fieldnames=fieldnames)
    writer.writeheader()
    for day in days:
        rows = []
        for pra, pairs in sorted(weights.items()):
            for variable in VARIABLES:
                row = aggregate(
                    pra,
                    day,
                    variable,
                    pairs,
                    by_day[day],
                    source_sha256=source_sha,
                    support_sha256=support_sha,
                    acquired_at=freshness,
                )
                rows.append(row)
                counts[variable][row["state"]] += 1
                if day >= days[-1] - timedelta(days=29):
                    windows[(pra, variable)].append(row)
                writer.writerow(
                    {
                        **{k: dict(row)[k] for k in fieldnames if k in row},
                        "region": names[pra]["region"],
                        "region_name": names[pra]["region_name"],
                        "reason": ";".join(row["quality_flags"]),
                    }
                )
        document = {
            "method": METHOD,
            "date": str(day),
            "source_sha256": source_sha,
            "support_sha256": support_sha,
            "rows": rows,
        }
        raw = encode(document)
        digest = sha(raw)
        if decode(raw, digest) != document:
            raise ValueError("Independent archive restoration differs")
        immutable(snapshots / f"{day}.json.gz", raw)
        manifest["days"].append({"date": str(day), "sha256": digest, "bytes": len(raw)})
        last_rows = rows
    immutable(snapshots / "manifest.json", serialized(manifest))
    # Evidence is gzip to keep a national date/variable matrix compact.
    immutable(
        output / "daily-matrix.csv.gz",
        gzip.compress(matrix_buffer.getvalue().encode(), mtime=0),
    )
    windows_report = {}
    for length in [7, 14, 30]:
        start = days[-1] - timedelta(days=length - 1)
        windows_report[str(length)] = dict(
            Counter(
                variable
                for (pra, variable), rows in windows.items()
                if reduce_window(
                    [r for r in rows if r["date"] >= str(start)], start, days[-1]
                )
                is not None
            )
        )
    summary = {
        "method": METHOD,
        "source_sha256": source_sha,
        "support_sha256": support_sha,
        "first_date": str(days[0]),
        "last_date": str(days[-1]),
        "dates": len(days),
        "native_rows": sum(len(rows) for rows in by_day.values()),
        "source_bytes": source.stat().st_size,
        "pra_count": len(weights),
        "corsica_count": 6,
        "state_counts_pra_days": {v: dict(c) for v, c in counts.items()},
        "last_day_states": dict(
            Counter(
                r["state"] for r in last_rows if r["variable"] == "temperature_mean"
            )
        ),
        "windows_complete_pra": windows_report,
        "coordinate_diagnostics": support["coordinate_diagnostics"],
        "intersections": support["intersections"],
        "seconds": round(time.monotonic() - started, 3),
        "peak_rss_kib": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        "archive_bytes": sum(e["bytes"] for e in manifest["days"]),
        "remote_writes": 0,
        "scientific_validation": "technical_checks_only",
    }
    (output / "summary.json").write_bytes(serialized(summary))
    last = {r["pra_id"]: r for r in last_rows if r["variable"] == "temperature_mean"}
    with (output / "COASTAL_713_MATRIX.csv").open("w") as stream:
        writer713 = csv.writer(stream)
        writer713.writerow(
            [
                "pra_id",
                "name",
                "region",
                "source",
                "method",
                "cells",
                "coverage",
                "state",
                "scientific_validation",
                "support_id",
            ]
        )
        for pra, pairs in sorted(weights.items()):
            r = last[pra]
            writer713.writerow(
                [
                    pra,
                    names[pra]["name"],
                    names[pra]["region_name"],
                    r["source"],
                    METHOD,
                    len(pairs),
                    r["spatial_coverage"],
                    r["state"],
                    r["scientific_validation"],
                    r["support_id"],
                ]
            )
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("work/couv01"))
    parser.add_argument("--output", type=Path, default=Path("work/couv01/pilot"))
    parser.add_argument("--acquire", action="store_true")
    args = parser.parse_args()
    resource.setrlimit(resource.RLIMIT_AS, (4 * 1024**3, 4 * 1024**3))
    signal.alarm(1320)
    args.root.mkdir(parents=True, exist_ok=True)
    args.output.mkdir(parents=True, exist_ok=True)
    if args.acquire:
        print(json.dumps(acquire(args.root)))
    print(json.dumps(pilot(args.root, args.output)))


if __name__ == "__main__":
    main()
