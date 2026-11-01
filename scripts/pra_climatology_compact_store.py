"""DEV-only immutable compact import and real server/API checks for Task22."""

from __future__ import annotations

import json
import math
import time

import numpy as np
import pra_climatology as core
from agriclimax.climate.pra_normals import RULE_VERSION
from pra_climatology_compact import EVIDENCE, METHOD, ROOT
from pra_climatology_store import rpc


def persist() -> None:
    manifest_path = ROOT / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    budget = json.loads((EVIDENCE / "storage-budget.json").read_text())
    if not budget["validated"] or manifest["pra"] != 713 or manifest["days"] != 366:
        raise ValueError("Annual completeness and measured budget required")
    if manifest["normal_cache_sha256"] != core.checksum(ROOT / "normal-cache.npz"):
        raise ValueError("Annual cache checksum mismatch")
    if manifest["task21_export_sha256"] != core.checksum(ROOT / "task21-export.json"):
        raise ValueError("Immutable Task21 export checksum mismatch")
    core.LABEL = "national"
    _, expected_ids = core.verify_bundle()
    with np.load(ROOT / "normal-cache.npz", allow_pickle=False) as cache:
        normal = cache["normal"].copy()
        counts = cache["sample_years"].copy()
        ids = cache["ids"].tolist()
    if (
        ids != expected_ids
        or normal.shape != (366, 713, 4)
        or counts.shape != normal.shape
    ):
        raise ValueError("Unexpected annual cache axes")
    if not np.array_equal(np.isfinite(normal), counts == 30):
        raise ValueError("NULL/count completeness mismatch")
    if np.isfinite(normal[59]).any() or (counts[59] > 8).any():
        raise ValueError("Invalid leap-day rule")
    provenance = {
        "source_id": "era5-land",
        "source_kind": "reanalysis",
        "rule_version": RULE_VERSION,
        "method": METHOD,
        "source_manifest_sha256": core.checksum(manifest_path),
        "reference_version": core.BUNDLE.name,
        "reference_period": [1991, 2020],
        "data_freshness": "historical_reference",
        "units": ["degC", "degC", "degC", "mm"],
        "variable_order": [
            "temperature_min",
            "temperature_max",
            "temperature",
            "precipitation",
        ],
        "current_coverage_order": [
            "temperature",
            "temperature_min",
            "temperature_max",
            "precipitation",
        ],
        "quality_flags": [
            "hourly_sampled_extrema",
            "total_PRA_area_not_agricultural_area",
            "full_spatial_support_required",
            "30_year_completeness_required",
            "no_interpolation",
            "no_seasonal_smoothing",
        ],
        "leap_day": manifest["leap_day"],
        "temporal_coverage": "sample_years / 30; spatial support must be complete for each year",
        "precision": "float32 normals as Task21; no derived anomalies persisted",
        "task21_reused_scalars": manifest["reused_task21_scalars"],
        "task21_export_sha256": manifest["task21_export_sha256"],
        "task21_reference_release": json.loads(
            (ROOT / "task21-export.json").read_text()
        )[0]["payload"]["release"]["version"],
    }
    version = (
        "era5land-pra1991-2020-annual-compact-v1-"
        + provenance["source_manifest_sha256"][:16]
    )
    rows = []
    for pi, pra in enumerate(ids):
        for di in range(366):
            values = [
                float(v) if math.isfinite(float(v)) else None for v in normal[di, pi]
            ]
            rows.append(
                dict(
                    zip(
                        [
                            "pra_id",
                            "day",
                            "tmin",
                            "tmax",
                            "tmean",
                            "rain",
                            "nmin",
                            "nmax",
                            "nmean",
                            "nrain",
                        ],
                        [pra, di + 1, *values, *map(int, counts[di, pi])],
                    )
                )
            )
    mark = time.monotonic()
    batches = []
    for offset in range(0, len(rows), 1000):
        changed = rpc(
            "agriclimax_persist_pra_climatology_daily",
            {
                "p_release": version,
                "p_reference": core.BUNDLE.name,
                "p_provenance": provenance,
                "p_rows": rows[offset : offset + 1000],
            },
        )
        if type(changed) is not int or not 0 <= changed <= len(
            rows[offset : offset + 1000]
        ):
            raise ValueError("Invalid immutable import receipt")
        batches.append({"offset": offset, "inserted": changed})
        core.document(
            ROOT / "import-progress.json", {"release": version, "batches": batches}
        )
    result = {
        "release": version,
        "rows": len(rows),
        "inserted": sum(b["inserted"] for b in batches),
        "seconds": time.monotonic() - mark,
        "batches": batches,
    }
    core.document(
        EVIDENCE / ("import.json" if result["inserted"] else "replay.json"), result
    )
    core.document(
        EVIDENCE / "release.json", {"version": version, "provenance": provenance}
    )
    print(json.dumps({k: v for k, v in result.items() if k != "batches"}), flush=True)


if __name__ == "__main__":
    persist()
