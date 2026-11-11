"""A real national cycle: shared IFS capture, WCS reductions, selection and acceptance."""

import hashlib
import json
import os
import resource
import subprocess
import sys
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

from agriclimax.ingestion.source_retry import retry_read
from agriclimax.ingestion.storage import atomic_write
from agriclimax.territories.national_weather import (
    RULE,
    compare_sources,
    select_daily_sources,
    validate_document,
)
from agriclimax.territories.spatial import Weight
from agriclimax.territories.weather_archive import decode, encode
from national_weather_models import reference, wcs_models
from national_weather_sources import Budget, preflight
from pra_weather_store import ArchiveStore


def coastal_audit(
    weights: dict[str, list[Weight]],
    territories: list[Any],
    ifs: dict[str, Any],
    root: Path,
    budget: Budget,
) -> dict[str, Any]:
    import eccodes as ec  # type: ignore[import-untyped]
    import numpy as np
    from shapely import contains_xy, prepare
    from shapely.geometry import shape
    from shapely.ops import unary_union

    union = unary_union([shape(t.geometry) for t in territories])
    prepare(union)
    result: dict[str, Any] = {
        "method": "grid-centre-territorial-proxy-1",
        "proxy_warning": "PRA reference surface is not a physical model land mask; foreign land may also lie outside the reference.",
        "sources": {},
    }
    for model, ws in weights.items():
        bycell = {w.cell_id: (w.longitude, w.latitude) for w in ws}
        keys = list(bycell)
        coords = np.array(list(bycell.values()))
        inside = dict(
            zip(keys, contains_xy(union, coords[:, 0], coords[:, 1]), strict=True)
        )
        groups: dict[str, list[Weight]] = defaultdict(list)
        for w in ws:
            groups[w.pra_id].append(w)
        result["sources"][model] = {
            pra: {
                "native_cells": len(group),
                "centre_inside_reference_fraction": sum(
                    w.weight for w in group if inside[w.cell_id]
                ),
                "physical_land_mask_available": False,
            }
            for pra, group in groups.items()
        }
    # A source land fraction is available for IFS and is distinct from the geometric proxy.
    index = [
        json.loads(line) for line in (root / "ifs/0.index").read_bytes().splitlines()
    ]
    entries = [
        e for e in index if e.get("param") == "lsm" and e.get("levtype") == "sfc"
    ]
    if len(entries) != 1:
        result["ifs_land_mask_status"] = "not_advertised"
        return result
    entry = entries[0]
    length = int(entry["_length"])
    offset = int(entry["_offset"])
    if length > 3 * 1024**2:
        raise ValueError("Unbounded land-mask field refused")
    path = root / "ifs/0-lsm.grib2"
    sha = path.with_suffix(".sha256")
    if path.exists():
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != sha.read_text():
            raise ValueError("Corrupt source land mask")
    else:
        url = ifs["source_url"] + "-0h-oper-fc.grib2"
        headers = {"Range": f"bytes={offset}-{offset + length - 1}"}
        def read_mask() -> bytes:
            budget.before(length + 1)
            budget.bytes += length + 1  # reserve even failed or partial transfers
            with urlopen(Request(url, headers=headers), timeout=20) as response:
                if (response.status != 206 or response.headers.get("Content-Range", "").split("/")[0]
                    != f"bytes {offset}-{offset + length - 1}"):
                    raise ValueError("Land-mask range not honored")
                value = response.read(length + 1)
            if len(value) != length:
                raise ValueError("Incomplete land-mask field")
            budget.bytes -= 1
            return bytes(value)
        raw = retry_read(read_mask, budget.wait)
        atomic_write(path, raw)
        atomic_write(sha, hashlib.sha256(raw).hexdigest().encode())
    handle = ec.codes_new_from_message(raw)
    try:
        if (
            ec.codes_get(handle, "shortName") != "lsm"
            or ec.codes_get(handle, "gridType") != "regular_ll"
            or abs(float(ec.codes_get(handle, "iDirectionIncrementInDegrees")) - 0.25)
            > 1e-8
        ):
            raise ValueError("Wrong IFS source land-mask grid")
        masks = {
            f"ifs.{float(lat):.2f}.{(float(lon) + 180) % 360 - 180:.2f}": float(v)
            for lat, lon, v in zip(
                *(
                    ec.codes_get_array(handle, k)
                    for k in ["latitudes", "longitudes", "values"]
                ),
                strict=True,
            )
            if -6.5 <= (float(lon) + 180) % 360 - 180 <= 10.5 and 40.5 <= lat <= 52.5
        }
    finally:
        ec.codes_release(handle)
    ifs_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for w in ifs["weights"]:
        ifs_groups[w["pra_id"]].append(w)
    result["sources"]["ifs"] = {
        pra: {
            "native_cells": len(group),
            "source_land_fraction": sum(
                w["weight"] * masks[w["cell_id"]] for w in group
            )
            if all(
                w["cell_id"] in masks and 0 <= masks[w["cell_id"]] <= 1 for w in group
            )
            else None,
            "physical_land_mask_available": True,
        }
        for pra, group in ifs_groups.items()
    }
    result["ifs_land_mask_status"] = (
        "verified_source_fraction_not_used_as_hidden_value_mask"
    )
    result["ifs_land_mask_sha256"] = hashlib.sha256(raw).hexdigest()
    return result


def run_national(
    root: Path, run: datetime, budget: Budget, publish: bool
) -> dict[str, Any]:
    resource.setrlimit(resource.RLIMIT_AS, (4 * 1024**3, 4 * 1024**3))
    root.mkdir(parents=True, exist_ok=True)
    (root / "audits").mkdir(exist_ok=True)
    territories, _ = reference()
    expected_ids = {t.id for t in territories}
    store = ArchiveStore() if publish else None
    if store:
        store.ensure_bucket()
        previous = next(
            (
                e
                for e in store.catalogue()["weather"]
                if e.get("run_at", e["run_date"] + "T00:00:00+00:00") == run.isoformat()
                and e["method_version"] == RULE
            ),
            None,
        )
        if previous:
            packed = store.blob(previous["path"], previous["sha256"])
            saved = decode(packed, previous["sha256"])
            validation = validate_document(saved, expected_ids)
            report = {
                "status": "idempotent_existing_publication",
                "validation": validation,
                "source_requests": budget.requests,
                "source_bytes": budget.bytes,
                "storage_writes": 0,
                "restored_sha256": previous["sha256"],
            }
            atomic_write(root / "report.json", json.dumps(report, indent=2).encode())
            return report
    initial = preflight(root, run, budget)
    if not initial["national_estimate"]["admissible"]:
        raise RuntimeError("National preflight resource estimate is incompatible")
    # Same IFS acquisition/decoder and native cache as Task26B; only the official scope expands.
    ifs_root = root / "ifs"
    subprocess.run(
        [
            sys.executable,
            "scripts/operational_weather_pilot.py",
            "--scope",
            "national",
            "--run-date",
            str(run.date()),
            "--root",
            str(ifs_root),
            "--execute",
        ],
        check=True,
        timeout=max(1, budget.seconds_limit - (time.monotonic() - budget.started) - 30),
        env={**os.environ, "IFS_REQUEST_LIMIT": str(budget.requests_limit - budget.requests),
             "IFS_BYTE_LIMIT": str(budget.bytes_limit - budget.bytes)},
    )
    ifs = json.loads((ifs_root / "cycle.json").read_text())
    budget.requests += ifs["metrics"]["network_requests"]
    budget.bytes += ifs["metrics"]["downloaded_bytes"]
    if budget.requests > budget.requests_limit or budget.bytes > budget.bytes_limit:
        raise RuntimeError("Combined national source budget exceeded")
    subprocess.run(
        [
            sys.executable,
            "tests/e2e/task26b-verify-native.py",
            "--root",
            str(ifs_root),
            "--output",
            str(root / "audits/ifs-independent.json"),
        ],
        check=True,
    )
    rows, audits, weights = wcs_models(root, run, budget)
    rows.extend(ifs["rows"])
    coastline = coastal_audit(weights, territories, ifs, root, budget)
    selected = select_daily_sources(rows, run.date(), expected_ids)
    document = {
        "contract_version": "pra-weather-1",
        "archive_version": "pra-weather-columnar-1",
        "scope": "national",
        "method_version": RULE,
        "reference_version": ifs["reference_version"],
        "run": run.isoformat(),
        "pra_count": 713,
        "rows": rows,
        "selected_indices": selected,
        "acquired_at": max(r["acquired_at"] for r in rows),
        "recent_estimate_status": "available_retrospective_forecast_not_analysis",
        "attribution": "Météo-France AROME/ARPEGE; ECMWF IFS Open Data CC-BY-4.0; PRA OFB/MASA; exploratory AgriclimaX",
        "coastal_audit": coastline,
    }
    validation = validate_document(document, expected_ids)
    comparisons = compare_sources(rows)
    packed = encode(document)
    checksum = hashlib.sha256(packed).hexdigest()
    if decode(packed, checksum) != document:
        raise ValueError("Complete national weather restoration failed")
    atomic_write(root / "cycle.compact.json.gz", packed)
    atomic_write(
        root / "comparison.json",
        json.dumps(
            {
                "pairs": comparisons,
                "station_comparison": "not_executed_in_this_run",
                "era5_comparison": "not_executed_in_this_run",
            },
            indent=2,
        ).encode(),
    )
    atomic_write(
        root / "audits/mf-independent.json", json.dumps(audits, indent=2).encode()
    )
    if sum(p.stat().st_size for p in root.rglob("*") if p.is_file()) > 448 * 1024**2:
        raise RuntimeError("Weather workspace budget exceeded before publication")
    publication = (
        store.publish_weather(document)
        if store
        else {"published": False, "reason": "Explicit DEV publish flag not provided"}
    )
    atomic_write(root / "publication.json", json.dumps(publication, indent=2).encode())
    report = {
        "status": "complete",
        "run": run.isoformat(),
        "validation": validation,
        "source_requests": budget.requests,
        "source_bytes": budget.bytes,
        "seconds": time.monotonic() - budget.started,
        "max_rss_kib": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        "archive_bytes": len(packed),
        "archive_sha256": checksum,
        "restoration_rows": len(rows),
        "source_dates": sorted({r["valid_date"] for r in rows}),
        "storage_24_month_projection_bytes": 730 * len(packed) + 730 * 258289,
        "storage_guard_bytes": 900 * 1024**2,
        "coastal": {
            model: {
                pra: entry
                for pra, entry in data.items()
                if pra
                in {"pra:29102", "pra:50081", "pra:06245", "pra:2A258", "pra:2B260"}
            }
            for model, data in coastline["sources"].items()
        },
        "publication": publication,
    }
    atomic_write(root / "report.json", json.dumps(report, indent=2).encode())
    return report
