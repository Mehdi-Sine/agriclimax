"""Deterministic 73-PRA operational sample; no contour or weight changes."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from agriclimax.territories.spatial import load_reference, projected

QUOTAS = {
    "11": 3,
    "24": 6,
    "27": 6,
    "28": 5,
    "32": 5,
    "44": 7,
    "52": 5,
    "53": 5,
    "75": 7,
    "76": 7,
    "84": 8,
    "93": 6,
    "94": 3,
}
ANCHORS = {
    "95332": "petite PRA nationale",
    "28341": "plaine céréalière Beauce",
    "29102": "Bretagne littorale, absence observée Task19",
    "29358": "littoral breton nord",
    "59325": "Nord et frontière maritime",
    "59025": "plaine intérieure du Nord",
    "51317": "plaine céréalière du Grand Est",
    "68303": "frontière est Sundgau",
    "88307": "massif vosgien",
    "39449": "massif du Jura et frontière suisse",
    "09472": "massif des Pyrénées et frontière",
    "40378": "façade Atlantique et Landes",
    "74458": "Alpes et frontière",
    "63426": "Massif central et Limagne",
    "05236": "haute montagne Dévoluy",
    "13244": "Méditerranée et Camargue",
    "13469": "littoral, réserve Marseille documentée",
    "69196": "réserve Lyon documentée",
    "2A258": "littoral corse potentiellement partiel",
    "2B260": "montagne corse",
    "76046": "Normandie et façade Manche",
}


def select(document: dict[str, Any], version: str) -> dict[str, Any]:
    territories, _ = load_reference(document, version=version)
    by_code = {t.code: t for t in territories}
    if set(ANCHORS) - set(by_code):
        raise ValueError("Anchor absent from versioned reference")
    centers = {t.code: projected(t.geometry).centroid for t in territories}
    selected = dict(ANCHORS)
    largest = max(territories, key=lambda t: (t.area_km2, t.code))
    selected.setdefault(largest.code, "plus grande PRA nationale")
    for region, quota in sorted(QUOTAS.items()):
        candidates = [t for t in territories if t.region == region]
        for t in [
            min(candidates, key=lambda t: (t.area_km2, t.code)),
            max(candidates, key=lambda t: (t.area_km2, t.code)),
        ]:
            if sum(by_code[c].region == region for c in selected) < quota:
                selected.setdefault(t.code, "extrême régional de surface")
        while sum(by_code[c].region == region for c in selected) < quota:
            present = [c for c in selected if by_code[c].region == region]
            remaining = [t for t in candidates if t.code not in selected]
            choice = max(
                remaining,
                key=lambda t: (
                    min(centers[t.code].distance(centers[c]) for c in present),
                    t.code,
                ),
            )
            selected[choice.code] = (
                "complément maximin des centroïdes EPSG:3035 dans la région"
            )
        if sum(by_code[c].region == region for c in selected) != quota:
            raise ValueError("Anchor quota exceeded")
    if len(selected) != 73:
        raise ValueError("Expected exactly 73 PRA")
    rows = []
    for code, reason in sorted(selected.items()):
        t = by_code[code]
        category = ["région " + t.region_name]
        upper = t.name.upper()
        if any(
            term in upper for term in ["LITTORAL", "CROZON", "MARITIME", "CAMARGUE"]
        ):
            category.append("littoral ou interface maritime")
        if any(
            term in upper
            for term in ["MONTAGNE", "ALPES", "PYRENE", "JURA", "DEVOLUY", "VOSGIENNE"]
        ):
            category.append("massif nommé")
        if t.area_km2 < 100:
            category.append("petite surface (<100 km²)")
        if t.area_km2 > 2000:
            category.append("grande surface (>2000 km²)")
        rows.append(
            {
                "id": t.id,
                "code": code,
                "name": t.name,
                "departments": [t.department],
                "region": t.region,
                "area_km2": t.area_km2,
                "categories": category,
                "selection_reason": reason,
            }
        )
    return {
        "selection_version": "pra-pilot73-maximin-1",
        "reference_version": version,
        "reference_sha256": hashlib.sha256(
            json.dumps(document, sort_keys=True).encode()
        ).hexdigest(),
        "quotas": QUOTAS,
        "selection_count": 73,
        "statistically_representative": False,
        "scientific_geometry_modified": False,
        "selection": rows,
    }


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--bundle", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    a = p.parse_args()
    manifest = json.loads((a.bundle / "manifest.json").read_text())
    result = select(
        json.loads((a.bundle / "reference.json").read_text()),
        manifest["reference_version"],
    )
    a.output.parent.mkdir(parents=True, exist_ok=True)
    a.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print("73 deterministic PRA selected; no geometry modified")


if __name__ == "__main__":
    main()
