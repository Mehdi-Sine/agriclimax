"""Read only existing GRIB checkpoints; compare explicit land-weighted means with published means."""

import gzip
import hashlib
import json
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from agriclimax.ingestion.storage import atomic_write
from agriclimax.territories.operational import daily_temperature
from agriclimax.territories.weather_archive import decode
from pra_weather_store import ArchiveStore


def review(root: Path) -> dict[str, Any]:
    import eccodes as ec  # type: ignore[import-untyped]

    store = ArchiveStore(read_only=True)
    catalogue = store.catalogue()
    entry = max(catalogue["weather"], key=lambda e: e.get("run_at", e["run_date"]))
    document = decode(store.blob(entry["path"], entry["sha256"]), entry["sha256"])
    cycle = datetime.fromisoformat(document["run"])
    day = cycle.date() + timedelta(days=1)
    start = datetime.combine(day, datetime.min.time(), UTC)
    result: dict[str, Any] = {"rule_version": "pra-explicit-land-weighted-sensitivity-1", "run": cycle.isoformat(), "date": str(day), "weather_sha256": entry["sha256"], "source_requests": 0, "storage_writes": 0, "production_values_changed": False, "sources": {}}
    for model in ["arome", "arpege"]:
        ws = json.loads(gzip.decompress((root / f"weights-{model}.json.gz").read_bytes()))["weights"]
        groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
        cells = {w["cell_id"] for w in ws}
        for w in ws:
            groups[w["pra_id"]].append(w)
        path = root / f"constant-{model}.grib2"
        if hashlib.sha256(path.read_bytes()).hexdigest() != path.with_suffix(".sha256").read_text():
            raise ValueError("Corrupt actual model mask")
        mask = {}
        with path.open("rb") as f:
            while (h := ec.codes_grib_new_from_file(f)) is not None:
                try:
                    if ec.codes_get(h, "shortName") == "lsm":
                        for lat, lon, v in zip(*(ec.codes_get_array(h, k) for k in ["latitudes", "longitudes", "values"]), strict=True):
                            cell = f"{model}.{float(lat):.3f}.{(float(lon)+180)%360-180:.3f}"
                            if cell in cells:
                                mask[cell] = float(v)
                finally:
                    ec.codes_release(h)
        samples: dict[int, dict[str, float]] = defaultdict(dict)
        for path in (root / model).glob("*.body"):
            raw = path.read_bytes()
            if raw[:4] != b"GRIB":
                continue
            h = ec.codes_new_from_message(raw)
            try:
                if ec.codes_get(h, "shortName") != "2t" or ec.codes_get(h, "dataDate") != int(cycle.strftime("%Y%m%d")) or ec.codes_get(h, "dataTime") != cycle.hour * 100:
                    continue
                at = datetime.strptime(f"{ec.codes_get(h, 'validityDate')}{int(ec.codes_get(h, 'validityTime')):04d}", "%Y%m%d%H%M").replace(tzinfo=UTC)
                offset = int((at - start).total_seconds() / 3600)
                if offset not in range(0, 25, 3):
                    continue
                arrays = [ec.codes_get_array(h, k) for k in ["latitudes", "longitudes", "values"]]
                corse = model == "arome" and min(arrays[0]) < 42
                for lat, lon, v in zip(*arrays, strict=True):
                    lon = (float(lon) + 180) % 360 - 180
                    cell = f"{model}.{float(lat):.3f}.{lon:.3f}"
                    if cell not in cells or corse and lat >= 42 and -6 <= lon <= 8.5:
                        continue
                    samples[offset][cell] = float(v)
            finally:
                ec.codes_release(h)
        if set(samples) != set(range(0, 25, 3)) or any(set(s) != cells for s in samples.values()):
            raise ValueError("Full cached native support required; this review never acquires a missing field")
        means = {cell: daily_temperature([samples[s][cell] for s in range(0, 25, 3)], list(range(0, 25, 3)))[0] for cell in cells}
        published = {r["pra_id"]: r["value"] for r in document["rows"] if r["source_id"] == f"meteofrance-{model}" and r["valid_date"] == str(day) and r["variable"] == "temperature"}
        output = {}
        for pra, group in groups.items():
            all_mean = sum(w["weight"] * means[w["cell_id"]] for w in group if means[w["cell_id"]] is not None)
            if abs(all_mean - published[pra]) > 1e-8:
                raise ValueError("Independent cached all-area mean differs from actual publication")
            land = sum(w["weight"] * mask[w["cell_id"]] for w in group)
            estimate = sum(w["weight"] * mask[w["cell_id"]] * means[w["cell_id"]] for w in group if means[w["cell_id"]] is not None) / land if land else None
            output[pra] = {"all_area_mean_degC": all_mean, "land_weighted_mean_degC": estimate, "difference_degC": estimate - all_mean if estimate is not None else None, "source_land_fraction": land, "exploratory": True, "production_value_replaced": False}
        result["sources"][model] = output
    atomic_write(root / "coastal-sensitivity.json", json.dumps(result, indent=2).encode())
    return result
