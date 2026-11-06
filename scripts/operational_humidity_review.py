"""Bounded native RH/dewpoint comparison: only one new tiny dewpoint field per model."""

import json
import math
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from agriclimax.ingestion.storage import atomic_write
from national_weather_sources import PARAMETERS, Budget, WcsProvider, grib_metadata


def review(root: Path) -> dict[str, Any]:
    budget = Budget(requests_limit=8, bytes_limit=2 * 1024**2, seconds_limit=120)
    result: dict[str, Any] = {"method": "native-rh-versus-same-model-dewpoint-water-magnus-1", "national_values_modified": False, "comparisons": []}
    for model in ["arome", "arpege"]:
        chosen = None
        for path in sorted((root / model).glob("*.body")):
            raw = path.read_bytes()
            if raw[:4] != b"GRIB":
                continue
            meta, values = grib_metadata(raw)
            if meta["shortName"] not in {"2r", "r"} or meta["dataTime"] != 600:
                continue
            points = [(lat, lon, value) for lat, lon, value in values if value is not None and 100 < value < 101]
            if points:
                chosen = (meta, max(points, key=lambda p: p[2]))
                break
        if chosen is None:
            result["comparisons"].append({"model": model, "status": "no_cached_06_rh_supersaturation_case"})
            continue
        meta, (lat, lon, native_rh) = chosen
        temperature = None
        for path in (root / model).glob("*.body"):
            raw = path.read_bytes()
            if raw[:4] != b"GRIB":
                continue
            tm, values = grib_metadata(raw)
            if tm["shortName"] == "2t" and all(tm[k] == meta[k] for k in ["dataDate", "dataTime", "validityDate", "validityTime"]):
                temperature = next((v for a, b, v in values if abs(a - lat) < 1e-7 and abs(b - lon) < 1e-7), temperature)
        if temperature is None:
            raise ValueError("Same-model cached T2m required")
        run = datetime.strptime(f"{meta['dataDate']}{meta['dataTime']:04d}", "%Y%m%d%H%M").replace(tzinfo=UTC)
        at = datetime.strptime(f"{meta['validityDate']}{meta['validityTime']:04d}", "%Y%m%d%H%M").replace(tzinfo=UTC)
        provider = WcsProvider(model, root, budget)
        ids = provider.catalogue()
        candidates = [value for value in ids if ("DEW_POINT" in value or "DEWPOINT" in value) and "SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND" in value and f"{run:%Y-%m-%dT%H.%M.%SZ}" in value]
        if not candidates:
            result["comparisons"].append({"model": model, "status": "same_run_dewpoint_not_advertised", "native_rh_percent": native_rh})
            continue
        PARAMETERS["dewpoint_review"] = candidates[0].split("___")[0]
        raw = provider.field(candidates[0], at, (lon - .05, lat - .05, lon + .05, lat + .05))
        dm, dewpoints = grib_metadata(raw)
        if dm["shortName"] not in {"2d", "dpt"} or dm["level"] != 2 or dm["units"] != "K" or any(dm[k] != meta[k] for k in ["dataDate", "dataTime", "validityDate", "validityTime"]):
            raise ValueError("Dewpoint comparison run/level/unit mismatch")
        dewpoint = next((v for a, b, v in dewpoints if abs(a - lat) < 1e-7 and abs(b - lon) < 1e-7), None)
        if dewpoint is None:
            raise ValueError("Exact same grid point missing from bounded comparison")
        t, d = temperature - 273.15, dewpoint - 273.15
        derived = 100 * math.exp(17.625 * d / (243.04 + d) - 17.625 * t / (243.04 + t))
        result["comparisons"].append({"model": model, "run": run.isoformat(), "validity": at.isoformat(), "latitude": lat, "longitude": lon, "native_rh_percent": native_rh, "temperature_k": temperature, "dewpoint_k": dewpoint, "water_magnus_rh_percent": derived, "native_minus_derived_percent": native_rh - derived, "no_clipping": True, "national_statistical_validation": False})
    result.update({"source_requests": budget.requests, "source_bytes": budget.bytes})
    atomic_write(root / "humidity-review.json", json.dumps(result, indent=2).encode())
    return result
