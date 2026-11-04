"""Prepare native administrative cartographic layers, preserving official PRA coordinates."""
import hashlib
import json
from pathlib import Path

from agriclimax.ingestion.storage import atomic_write


def main() -> None:
    evidence = {}
    out = Path("apps/web/public/maps")
    for kind, scale, prefix in (("departements", "departement", "dep:"), ("regions", "region", "reg:")):
        source = Path(f"work/task25/{kind}-contours.geojson")
        raw = source.read_bytes()
        collection = json.loads(raw)
        features = []
        # The product's existing map extent is metropolitan France and Corsica.
        for f in collection["features"]:
            p = f["properties"]
            if len(p["code"]) > 2 or p["code"] in {"01", "02", "03", "04", "06"} and scale == "region":
                continue
            f["id"] = prefix + p["code"]
            f["properties"] = {"code": p["code"], "name": p["nom"], "department_name": p["nom"] if scale == "departement" else "", "region_name": ""}
            features.append(f)
        payload = {"type": "FeatureCollection", "features": features}
        atomic_write(out / f"agriculture-{scale}.geojson", json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode())
        evidence[scale] = {"source": f"https://etalab-datasets.geo.data.gouv.fr/contours-administratifs/2025/geojson/{kind}-100m.geojson", "sha256": hashlib.sha256(raw).hexdigest(), "features": len(features), "simplification": "100m (publisher)", "scope": "metropolitan France and Corsica", "license": "Licence Ouverte 2.0"}
    atomic_write(Path("docs/codex/task25/geography.json"), json.dumps(evidence, ensure_ascii=False, indent=2).encode())


if __name__ == "__main__":
    main()
