"""Checks on the supplied OFB/MASA snapshot; no national climate coverage claim."""

import hashlib
import json
from collections import defaultdict
from pathlib import Path

import pytest
from pyproj import Geod
from shapely.geometry import box, mapping, shape

from agriclimax.territories.spatial import projected

ROOT = Path(__file__).resolve().parents[3]
BUNDLE = ROOT / "config/coverage/ofb-masa-pra-2017-snapshot-20261017"


def test_official_bundle_integrity_and_complete_code_support():
    checksums = json.loads((BUNDLE / "checksums.json").read_text())
    for name, expected in checksums.items():
        assert hashlib.sha256((BUNDLE / name).read_bytes()).hexdigest() == expected
    reference = json.loads((BUNDLE / "reference.json").read_text())
    features = reference["features"]
    ids = {f["properties"]["code"] for f in features}
    assert len(features) == len(ids) == 713
    assert "75000" not in ids
    assert sum(c.startswith(("2A", "2B")) for c in ids) == 6
    assert all(shape(f["geometry"]).is_valid for f in features)
    weights = json.loads((BUNDLE / "weights.json").read_text())
    by_pra = defaultdict(list)
    for w in weights:
        by_pra[w["pra_id"]].append(w)
        assert w["cell_id"] == f"era5land.{w['latitude']:.1f}.{w['longitude']:.1f}"
        assert w["weight"] > 0 and w["intersection_km2"] > 0
        assert abs(w["longitude"] * 10 - round(w["longitude"] * 10)) < 1e-10
        assert abs(w["latitude"] * 10 - round(w["latitude"] * 10)) < 1e-10
    assert set(by_pra) == {"pra:" + c for c in ids}
    assert all(abs(sum(w["weight"] for w in rows) - 1) < 1e-4 for rows in by_pra.values())
    manifest = json.loads((BUNDLE / "manifest.json").read_text())
    assert manifest["source_provenance"]["original_xml_checksum_verified"] is False
    assert manifest["reference_verified_national"] is False  # Independent admin check pending.


@pytest.mark.parametrize("code", ["95332", "05236", "28341", "29102", "2B260"])
def test_real_pra_weights_against_independent_cell_intersections(code):
    reference = json.loads((BUNDLE / "reference.json").read_text())
    feature = next(f for f in reference["features"] if f["properties"]["code"] == code)
    polygon = projected(feature["geometry"])
    geodesic_area = abs(Geod(ellps="WGS84").geometry_area_perimeter(shape(feature["geometry"]))[0])
    assert abs(polygon.area / geodesic_area - 1) < 0.0001
    weights = [
        w for w in json.loads((BUNDLE / "weights.json").read_text()) if w["pra_id"] == "pra:" + code
    ]
    assert abs(sum(w["intersection_km2"] for w in weights) * 1e6 / polygon.area - 1) < 0.0001
    for w in weights:
        lon, lat = w["longitude"], w["latitude"]
        footprint = projected(
            mapping(box(lon - 0.05, lat - 0.05, lon + 0.05, lat + 0.05).segmentize(0.005))
        )
        actual = polygon.intersection(footprint).area / polygon.area
        assert abs(actual - w["weight"]) < 1e-5
    if code == "95332":
        assert polygon.area < projected(mapping(box(1.65, 49.05, 1.75, 49.15))).area
