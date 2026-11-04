"""National RPG2025 regional streaming acquisition/area overlay with resumable checkpoints.

Raw archives/GeoPackages stay outside Git and PostgreSQL. A region is published only
after its complete parcel cursor has been consumed and conservation checks have passed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sqlite3
import subprocess
import urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict, deque
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

import py7zr
from agriclimax.agriculture.spatial import (
    PraAllocator,
    gpkg_geometry,
    record_fingerprint,
)
from agriclimax.ingestion.storage import atomic_write
from agriculture_cache import compact, restore

REGIONS = ["11", "24", "27", "28", "32", "44", "52", "53", "75", "76", "84", "93", "94"]
BASE = "https://data.geopf.fr/telechargement"
REFERENCE = Path("config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json")


def save(path: Path, data: object) -> None:
    atomic_write(path, json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode())


def digest(path: Path) -> str:
    with path.open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()


def download(url: str, path: Path, expected_bytes: int | None = None) -> None:
    if path.exists():
        if expected_bytes is not None and path.stat().st_size != expected_bytes:
            raise ValueError("Cached archive size mismatch")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".part")
    if expected_bytes is not None:
        # Bounded ranges survive proxy truncation without restarting a 1–2GB
        # delivery. A chunk is appended only after exact Content-Range/size checks;
        # the publisher checksum is checked before any parcel extraction.
        chunk_bytes = 16 * 1024 * 1024
        offset = temporary.stat().st_size if temporary.exists() else 0
        if offset > expected_bytes:
            raise ValueError("Oversized partial source archive")

        def fetch(start: int) -> Path:
            end = min(start + chunk_bytes, expected_bytes) - 1
            chunk = path.with_suffix(f".chunk-{start}")
            headers_path = path.with_suffix(f".headers-{start}")
            subprocess.run(["curl", "--fail", "--location", "--silent", "--show-error",
                            "--connect-timeout", "30", "--max-time", "180", "--retry", "3",
                            "--range", f"{start}-{end}", "--max-filesize", str(end-start+1),
                            "--dump-header", str(headers_path), "--output", str(chunk), url], check=True)
            headers = headers_path.read_text().lower().splitlines()
            expected_range = f"content-range: bytes {start}-{end}/{expected_bytes}"
            statuses = [line.split()[1] for line in headers if line.startswith("http/")]
            if not statuses or statuses[-1] != "206" or expected_range not in [line.strip() for line in headers] or chunk.stat().st_size != end-start+1:
                raise ValueError("Invalid bounded source range")
            return chunk

        while offset < expected_bytes:
            starts = list(range(offset, min(offset + chunk_bytes * 4, expected_bytes), chunk_bytes))
            with ThreadPoolExecutor(max_workers=4) as workers:
                chunks = list(workers.map(fetch, starts))
            with temporary.open("ab") as output:
                for chunk in chunks:
                    with chunk.open("rb") as stream:
                        shutil.copyfileobj(stream, output)
                    # Only the verified duplicate chunk is removed after appending.
                    chunk.unlink()
                    offset = output.tell()
            print(json.dumps({"downloaded_bytes": offset, "expected_bytes": expected_bytes}), flush=True)
        if temporary.stat().st_size != expected_bytes:
            raise ValueError("Truncated source archive")
        temporary.replace(path)
        return
    # Partial HTTP data is never promoted. Reuse complete cache, restart failed requests.
    offset = temporary.stat().st_size if temporary.exists() and expected_bytes else 0
    headers = {"User-Agent": "AgriclimaX/Task25 official-data-ingestion"}
    if offset:
        headers["Range"] = f"bytes={offset}-"
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=90) as response:
        append = offset > 0 and response.status == 206
        if append and not response.headers.get('Content-Range', '').startswith(f'bytes {offset}-'):
            raise ValueError('Invalid resumed range')
        with temporary.open("ab" if append else "wb") as output:
            shutil.copyfileobj(response, output, 1024 * 1024)
    if expected_bytes is not None and temporary.stat().st_size != expected_bytes:
        raise ValueError("Truncated source archive")
    temporary.replace(path)


_WORKER_DB: sqlite3.Connection | None = None
_WORKER_ALLOCATOR: PraAllocator | None = None


def init_overlay_worker(gpkg: str, reference: str) -> None:
    global _WORKER_DB, _WORKER_ALLOCATOR
    _WORKER_DB = sqlite3.connect(f"file:{gpkg}?mode=ro&immutable=1", uri=True)
    _WORKER_ALLOCATOR = PraAllocator(json.loads(Path(reference).read_text())["features"])


def overlay_batch(batch: list[tuple]) -> tuple[dict, dict, int]:
    if _WORKER_DB is None or _WORKER_ALLOCATOR is None:
        raise RuntimeError("Overlay worker not initialized")
    aggregates = defaultdict(float)
    groups = defaultdict(lambda: defaultdict(float))
    invalid = 0
    neighbour_sql = """select p.geom from rtree_RPG_Parcelles_geom r join RPG_Parcelles p on p.fid=r.id
       where r.minx<=? and r.maxx>=? and r.miny<=? and r.maxy>=? and p.fid<?"""
    for fid, group, declared, blob in batch:
        geometry = gpkg_geometry(blob)
        minx, miny, maxx, maxy = geometry.bounds
        neighbours = [gpkg_geometry(b[0]) for b in _WORKER_DB.execute(neighbour_sql, (maxx, minx, maxy, miny, fid))]
        result = _WORKER_ALLOCATOR.allocate(geometry, 2154, neighbours)
        invalid += result.invalid_geometry
        group = str(group)
        for code, area in result.hectares.items():
            aggregates[(code, group)] += area
        g = groups[group]
        for key, value in (("source_geometry_ha", result.source_ha), ("accepted_ha", result.accepted_ha), ("outside_pra_ha", result.outside_ha), ("excluded_overlap_ha", result.overlap_ha), ("allocated_ha", sum(result.hectares.values())), ("declared_ha", declared or 0)):
            g[key] += value
        g["parcels"] += 1
    return dict(aggregates), {g: dict(v) for g, v in groups.items()}, invalid


def bounded_overlay(batches, gpkg: Path, workers: int):
    # A bounded queue avoids Executor.map eagerly buffering a whole national
    # delivery. Each result is merged in source order, independent of scheduling.
    with ProcessPoolExecutor(max_workers=workers, initializer=init_overlay_worker,
                             initargs=(str(gpkg), str(REFERENCE))) as pool:
        pending = deque()
        for batch in batches:
            pending.append(pool.submit(overlay_batch, batch))
            if len(pending) >= workers * 2:
                yield pending.popleft().result()
        while pending:
            yield pending.popleft().result()


def process_region(region: str, cache: Path, allocator: PraAllocator, reference_sha: str, workers: int = 2) -> dict:
    checkpoint = cache / f"R{region}-complete.json"
    if checkpoint.exists():
        data = json.loads(checkpoint.read_text())
        if data["reference_sha256"] != reference_sha or data["rule_version"] != "rpg-area-1":
            raise ValueError("Checkpoint does not match reference/method")
        # Rebuild compact identity indexes from retained inputs when resuming an
        # earlier checkpoint, without redoing the costly scientific overlay.
        identities = sqlite3.connect(cache / 'parcel-identities.sqlite')
        identities.execute('create table if not exists parcel_identity_v2 (id text primary key, fingerprint blob not null, region text not null)')
        if not identities.execute('select 1 from parcel_identity_v2 where region=? limit 1', (region,)).fetchone():
            source = next((cache / f'R{region}-extract').rglob('RPG_Parcelles.gpkg'), None)
            if source is None:
                source = restore(cache, region)
            with sqlite3.connect(f'file:{source}?mode=ro', uri=True) as source_db:
                for identifier, blob, culture, group, declared in source_db.execute('select id_parcel,geom,code_cultu,code_group,surf_parc from RPG_Parcelles'):
                    fingerprint = record_fingerprint(blob, culture, group, declared)
                    prior = identities.execute('select fingerprint from parcel_identity_v2 where id=?', (str(identifier),)).fetchone()
                    if prior is not None and prior[0] != fingerprint:
                        raise ValueError('Conflicting source identity while rebuilding a checkpoint')
                    identities.execute('insert or ignore into parcel_identity_v2 values (?,?,?)', (str(identifier), fingerprint, region))
            identities.commit()
        identities.close()
        return data
    name = f"RPG_4-0__GPKG_LAMB93_R{region}_2025-01-01"
    metadata_url = f"{BASE}/resource/RPG/{name}"
    metadata_path = cache / f"R{region}-metadata.xml"
    download(metadata_url, metadata_path)
    root = ET.parse(metadata_path)
    ns = {"a": "http://www.w3.org/2005/Atom"}
    entry = root.find("a:entry", ns)
    if entry is None:
        raise ValueError("Missing official regional delivery")
    link = entry.find("a:link", ns)
    url = link.attrib["href"]
    expected = int(link.attrib["{https://data.geopf.fr/annexes/ressources/xsd/gpf_dl.xsd}length"])
    archive = cache / f"R{region}.7z"
    existing_layer = next((cache / f'R{region}-extract').rglob('RPG_Parcelles.gpkg'), None)
    required = (0 if archive.exists() else expected) + (0 if existing_layer else expected) + 256 * 1024 * 1024
    if shutil.disk_usage(cache).free < required:
        raise ValueError("Insufficient disk for bounded regional extraction; keep checkpoints")
    print(json.dumps({"region": region, "step": "download", "bytes": expected}), flush=True)
    # Accept the inspected initial acquisition filename when it is byte-complete.
    initial = cache / f"rpg{region}.7z"
    if initial.exists() and not archive.exists():
        initial.rename(archive)
    download(url, archive, expected)
    sha = digest(archive)
    publisher_checksum = entry.findtext("a:content", namespaces=ns)
    if publisher_checksum and len(publisher_checksum) == 32:
        with archive.open("rb") as stream:
            if hashlib.file_digest(stream, "md5").hexdigest() != publisher_checksum:
                raise ValueError("Official regional delivery checksum mismatch")
    directory = cache / f"R{region}-extract"
    with py7zr.SevenZipFile(archive) as zipped:
        members = [p for p in zipped.getnames() if p.endswith("/RPG_Parcelles.gpkg")]
        if len(members) != 1 or any(".." in Path(m).parts for m in members):
            raise ValueError("Unreviewed RPG archive layout")
        gpkg = directory / members[0]
        if not gpkg.exists():
            zipped.extract(directory, targets=members)
    print(json.dumps({"region": region, "step": "intersect", "archive_sha256": sha}), flush=True)
    db = sqlite3.connect(f"file:{gpkg}?mode=ro", uri=True)
    metadata = db.execute("select table_name,column_name,srs_id from gpkg_geometry_columns").fetchall()
    if metadata != [("RPG_Parcelles", "geom", 2154)]:
        raise ValueError(f"Unexpected RPG CRS/schema: {metadata}")
    rows = db.execute("select fid,id_parcel,code_cultu,code_group,surf_parc,geom from RPG_Parcelles order by fid")
    identities = sqlite3.connect(cache / 'parcel-identities.sqlite')
    identities.execute('create table if not exists parcel_identity_v2 (id text primary key, fingerprint blob not null, region text not null)')
    aggregates = defaultdict(float)
    groups = defaultdict(lambda: defaultdict(float))
    ids: dict[str, bytes] = {}
    count = 0
    invalid = 0
    duplicates = 0
    def batches():
        nonlocal count, duplicates
        batch = []
        for fid, parcel_id, culture, group, declared, blob in rows:
            count += 1
            if not isinstance(parcel_id, str) or not parcel_id.strip():
                raise ValueError("Missing parcel identifier")
            fingerprint = record_fingerprint(blob, culture, group, declared)
            prior = identities.execute('select fingerprint from parcel_identity_v2 where id=? and region<>?', (parcel_id, region)).fetchone()
            if prior:
                if prior[0] != fingerprint:
                    raise ValueError("Conflicting parcel ID across regional deliveries")
                duplicates += 1
                continue
            if parcel_id in ids:
                if ids[parcel_id] != fingerprint:
                    raise ValueError("Conflicting duplicate parcel ID")
                duplicates += 1
                continue
            ids[parcel_id] = fingerprint
            batch.append((fid, group, declared, blob))
            if len(batch) == 1000:
                yield batch
                batch = []
        if batch:
            yield batch

    processed = 0
    for batch_aggregates, batch_groups, batch_invalid in bounded_overlay(batches(), gpkg, workers):
        invalid += batch_invalid
        for key, area in batch_aggregates.items():
            aggregates[key] += area
        for group, metrics in batch_groups.items():
            for key, value in metrics.items():
                groups[group][key] += value
            processed += int(metrics['parcels'])
        if processed % 10000 == 0:
            print(json.dumps({"region": region, "parcels": processed}), flush=True)
    db.close()
    identities.executemany('insert or replace into parcel_identity_v2 values (?,?,?)', ((identifier, fingerprint, region) for identifier, fingerprint in ids.items()))
    identities.commit()
    identities.close()
    for g in groups.values():
        residual = g["source_geometry_ha"] - g["excluded_overlap_ha"] - g["outside_pra_ha"] - g["allocated_ha"]
        if abs(residual) > 0.001:
            raise ValueError("Area conservation check failed")
        g["conservation_residual_ha"] = residual
        # Declared hectares are rounded per parcel, while measured areas are geometric.
        tolerance = g["source_geometry_ha"] * 0.005 + g["parcels"] * 0.005
        g["declared_area_tolerance_ha"] = tolerance
        g["declared_area_check"] = abs(g["source_geometry_ha"] - g["declared_ha"]) <= tolerance
    data = {"region": region, "year": 2025, "rule_version": "rpg-area-1", "source_url": url,
            "archive_sha256": sha, "archive_bytes": expected, "acquired_at": datetime.now(UTC).isoformat(),
            "reference_sha256": reference_sha, "parcels": count, "invalid_geometries": invalid,
            "duplicate_ids": duplicates, "repaired_pra_codes": allocator.repaired_pra_codes,
            "groups": dict(groups), "aggregates": [[code, group, area] for (code, group), area in sorted(aggregates.items())],
            "quality_flags": ["cross_region_distinct_id_overlap_not_checked"],
            "parcel_id_digest": hashlib.sha256("\n".join(sorted(ids)).encode()).hexdigest()}
    save(checkpoint, data)
    # Keep the source until optional verified lossless compaction in main().
    return data


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--cache", type=Path, default=Path("work/task25"))
    p.add_argument("--regions", nargs="+", default=REGIONS, choices=REGIONS)
    p.add_argument("--workers", type=int, choices=(1, 2), default=2, help="Bounded independent geometry workers, deterministic 1000-parcel batches")
    p.add_argument("--compact-cache", action="store_true", help="Retain verified byte-identical Parcelles XZ, evict redundant delivery/working copies only after completed checkpoints")
    args = p.parse_args()
    features = json.loads(REFERENCE.read_text())["features"]
    if len(features) != 713:
        raise ValueError("Expected official 713-PRA snapshot")
    allocator = PraAllocator(features)
    for region in args.regions:
        process_region(region, args.cache, allocator, digest(REFERENCE), args.workers)
        if args.compact_cache:
            compact(args.cache, region, evict=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
