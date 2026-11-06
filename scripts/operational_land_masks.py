"""Official Météo-France constant fields, verified grid masks and explicit coastal sensitivity."""

import gzip
import hashlib
import json
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from agriclimax.ingestion.storage import atomic_write
from agriclimax.territories.weather_archive import decode
from pra_weather_store import BUCKET, ArchiveStore

SOURCES = {
    "arome": "https://www.data.gouv.fr/api/1/datasets/r/2ea15b4c-36e1-47ba-98d3-43c09c9aef65",
    "arpege": "https://www.data.gouv.fr/api/1/datasets/r/efd2b9d9-5e94-4090-9ea0-eac93f17e33b",
}
DOCUMENTATION = "https://confluence-meteofrance.atlassian.net/wiki/spaces/OpenDataMeteoFrance/pages/621019138"


class OfficialRedirects(HTTPRedirectHandler):
    def redirect_request(self, req: Any, fp: Any, code: int, msg: str, headers: Any, newurl: str) -> Any:
        target = urlsplit(newurl)
        if target.scheme != "https" or target.hostname not in {"www.data.gouv.fr", "static.data.gouv.fr", "object.files.data.gouv.fr", "object.data.gouv.fr", "data.gouv.fr"}:
            raise ValueError("Unreviewed constant-field redirect")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def run(root: Path, publish: bool) -> dict[str, Any]:
    import eccodes as ec  # type: ignore[import-untyped]

    store = ArchiveStore(read_only=not publish)
    catalogue = store.catalogue()
    previous = catalogue.get("land_masks")
    if previous:
        existing = json.loads(gzip.decompress(store.blob(previous["path"], previous["sha256"])))
        if existing.get("rule_version") == "pra-official-model-land-fraction-1" and all(existing["sources"][model]["source_url"] == url for model, url in SOURCES.items()):
            result = {"status": "read_only_verified_existing_mask_publication", "source_requests": 0, "source_bytes": 0, "storage_writes": 0, "sha256": previous["sha256"]}
            atomic_write(root / "official-land-masks.json", json.dumps(result, indent=2).encode())
            return result
    entry = max(catalogue["weather"], key=lambda e: e.get("run_at", e["run_date"]))
    decode(store.blob(entry["path"], entry["sha256"]), entry["sha256"])
    output: dict[str, Any] = {"rule_version": "pra-official-model-land-fraction-1", "documentation": DOCUMENTATION, "computed_at": datetime.now(UTC).isoformat(), "sources": {}, "source_requests": 0, "source_bytes": 0, "value_renormalization_applied": False}
    for model, url in SOURCES.items():
        path = root / f"constant-{model}.grib2"
        if path.exists():
            raw = path.read_bytes()
            if hashlib.sha256(raw).hexdigest() != path.with_suffix(".sha256").read_text():
                raise ValueError("Corrupt official model mask checkpoint")
        else:
            with build_opener(OfficialRedirects()).open(Request(url), timeout=30) as response:
                raw = response.read(16 * 1024**2 + 1)
            if len(raw) > 16 * 1024**2:
                raise ValueError("Constant field budget exceeded")
            atomic_write(path, raw)
            atomic_write(path.with_suffix(".sha256"), hashlib.sha256(raw).hexdigest().encode())
            output["source_requests"] += 1
            output["source_bytes"] += len(raw)
        weights = json.loads(gzip.decompress((root / f"weights-{model}.json.gz").read_bytes()))["weights"]
        groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
        cells = {w["cell_id"] for w in weights}
        for w in weights:
            groups[w["pra_id"]].append(w)
        masks: dict[str, float] = {}
        grid = {}
        with path.open("rb") as stream:
            while (h := ec.codes_grib_new_from_file(stream)) is not None:
                try:
                    if ec.codes_get(h, "shortName") != "lsm":
                        continue
                    grid = {k: ec.codes_get(h, k) for k in ["gridType", "iDirectionIncrementInDegrees", "jDirectionIncrementInDegrees", "shortName", "units"]}
                    spacing = .025 if model == "arome" else .1
                    if grid["gridType"] != "regular_ll" or abs(grid["iDirectionIncrementInDegrees"] - spacing) > 1e-8 or abs(grid["jDirectionIncrementInDegrees"] - spacing) > 1e-8:
                        raise ValueError("Official mask does not match operational grid")
                    for lat, lon, value in zip(*(ec.codes_get_array(h, k) for k in ["latitudes", "longitudes", "values"]), strict=True):
                        lon = (float(lon) + 180) % 360 - 180
                        key = f"{model}.{float(lat):.3f}.{lon:.3f}"
                        if key in cells:
                            if not 0 <= value <= 1:
                                raise ValueError("Invalid land fraction")
                            masks[key] = float(value)
                finally:
                    ec.codes_release(h)
        if set(masks) != cells:
            raise ValueError("Official land mask lacks required native support")
        fractions = {pra: {"native_cells": len(ws), "physical_land_mask_available": True, "source_land_fraction": sum(w["weight"] * masks[w["cell_id"]] for w in ws), "mask_sha256": hashlib.sha256(raw).hexdigest()} for pra, ws in groups.items()}
        if len(fractions) != 713:
            raise ValueError("National mask aggregation incomplete")
        output["sources"][model] = {"source_url": url, "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw), "grid": grid, "pra": fractions}
    atomic_write(root / "official-land-masks.json", json.dumps(output, indent=2).encode())
    if publish:
        packed = gzip.compress(json.dumps(output, sort_keys=True).encode(), mtime=0)
        sha = hashlib.sha256(packed).hexdigest()
        pointer = {"path": f"support/{sha}.json.gz", "sha256": sha, "bytes": len(packed), "dates": [], "method_version": output["rule_version"]}
        store.put_immutable(pointer["path"], packed)
        catalogue = store.catalogue()
        catalogue["land_masks"] = pointer
        store.request(f"object/{BUCKET}/catalogue.json", "POST", json.dumps(catalogue, sort_keys=True).encode(), upsert=True)
        if store.catalogue().get("land_masks") != pointer:
            raise ValueError("Official mask catalogue readback mismatch")
        store.publish_current(catalogue)
        output["publication"] = {**pointer, "storage_writes": store.writes}
    return output
