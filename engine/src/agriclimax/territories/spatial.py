"""Authoritative polygons are never repaired/simplified silently; areas use EPSG:3035."""

import hashlib
import json
import math
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from pyproj import Transformer
from shapely.geometry import box, mapping, shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree

METHOD = "total-area-epsg3035-1"


@dataclass(frozen=True)
class Territory:
    id: str
    code: str
    name: str
    department: str
    department_name: str
    region: str
    region_name: str
    geometry: dict[str, Any]
    area_km2: float


@dataclass(frozen=True)
class Weight:
    pra_id: str
    cell_id: str
    longitude: float
    latitude: float
    intersection_km2: float
    weight: float
    method: str = METHOD


@lru_cache(maxsize=8)
def _area_transformer(source_crs: str) -> Transformer:
    """Reuse immutable PROJ transforms across native-cell intersections."""
    return Transformer.from_crs(source_crs, "EPSG:3035", always_xy=True)


def projected(geometry: dict[str, Any], source_crs: str = "EPSG:4326") -> Any:
    """Shapely's geometry API is dynamically typed; validate runtime types explicitly."""
    polygon = shape(geometry)
    if (
        polygon.geom_type not in {"Polygon", "MultiPolygon"}
        or polygon.is_empty
        or not polygon.is_valid
    ):
        raise ValueError("Invalid polygon: source correction/review required")
    transformer = _area_transformer(source_crs)
    return transform(transformer.transform, polygon)


def load_reference(
    document: dict[str, Any], *, version: str
) -> tuple[list[Territory], dict[str, Any]]:
    """Input: explicit normalized GeoJSON WGS84, properties retain official string codes.

    Adapter must name original CRS/version and source fields in a checksum manifest.
    Do not coerce numeric codes: lost leading zeros must be fixed at source.
    """
    if not re.fullmatch(r"[a-zA-Z0-9_.-]{1,80}", version):
        raise ValueError("Invalid reference version")
    if document.get("type") != "FeatureCollection" or "crs" in document:
        raise ValueError("Normalized RFC7946 WGS84 FeatureCollection required")
    territories = []
    geometries = []
    for feature in document["features"]:
        p = feature["properties"]
        fields = ["code", "name", "department", "department_name", "region", "region_name"]
        if any(not isinstance(p.get(k), str) or not 1 <= len(p[k]) <= 200 for k in fields):
            raise ValueError("Official geographic string attributes required")
        if not re.fullmatch(r"(?:0[1-9]|[1-8][0-9]|9[0-5]|2[AB])", p["department"]):
            raise ValueError("Metropolitan department code required")
        if not p["code"].startswith(p["department"]) or not re.fullmatch(
            r"[0-9AB]{4,8}", p["code"]
        ):
            raise ValueError("PRA code must retain its departmental identity")
        if not re.fullmatch(r"[0-9]{2}", p["region"]):
            raise ValueError("Official region code required")
        polygon = projected(feature["geometry"])
        bounds = shape(feature["geometry"]).bounds
        if bounds[0] < -6 or bounds[1] < 41 or bounds[2] > 10 or bounds[3] > 52:
            raise ValueError("Outside metropolitan scope")
        geometries.append(polygon)
        territories.append(
            Territory(
                id=f"pra:{p['code']}",
                **{k: p[k] for k in fields},
                geometry=feature["geometry"],
                area_km2=polygon.area / 1e6,
            )
        )
    if not territories or len({t.id for t in territories}) != len(territories):
        raise ValueError("Empty/duplicate official PRA IDs")
    for dep in {t.department for t in territories}:
        if (
            len(
                {
                    (t.department_name, t.region, t.region_name)
                    for t in territories
                    if t.department == dep
                }
            )
            != 1
        ):
            raise ValueError("Inconsistent departmental hierarchy")
    tree = STRtree(geometries)
    overlap_km2 = 0.0
    for i, polygon in enumerate(geometries):
        for j in tree.query(polygon, predicate="intersects"):
            if j > i:
                overlap_km2 += polygon.intersection(geometries[j]).area / 1e6
    union = unary_union(geometries)
    # Gaps relative to an independent administrative mask are a separate required
    # validation, never silently inferred from a bounding box containing sea.
    report = {
        "reference_version": version,
        "imported_count": len(territories),
        "expected_official_count": 713,
        "count_matches_expected": len(territories) == 713,
        "valid_geometry_count": len(geometries),
        "area_km2": union.area / 1e6,
        "overlap_km2": overlap_km2,
        "corsica_departments": sorted(
            {t.department for t in territories if t.department in {"2A", "2B"}}
        ),
        "multipart_count": sum(shape(t.geometry).geom_type == "MultiPolygon" for t in territories),
        "independent_boundary_gap_check": "pending",
        "crs": "EPSG:4326",
        "area_crs": "EPSG:3035",
        "normalized_sha256": hashlib.sha256(
            json.dumps(document, sort_keys=True).encode()
        ).hexdigest(),
    }
    if overlap_km2 > 0.001:
        raise ValueError("Unexpected overlapping PRA polygons; review source")
    return sorted(territories, key=lambda t: t.id), report


def correspondence(territories: list[Territory]) -> list[Weight]:
    """Native 0.1° centre footprints, including centres outside coastal polygons.

    Weight denominator is full authoritative PRA area, never a weather-valid subset.
    Densify parallels/meridians before reprojection for deterministic area integration.
    """
    result: list[Weight] = []
    for territory in sorted(territories, key=lambda t: t.id):
        polygon = projected(territory.geometry)
        west, south, east, north = shape(territory.geometry).bounds
        start = len(result)
        for lat in range(math.ceil((south - 0.05) * 10), math.floor((north + 0.05) * 10) + 1):
            for lon in range(math.ceil((west - 0.05) * 10), math.floor((east + 0.05) * 10) + 1):
                cell = box(
                    lon / 10 - 0.05, lat / 10 - 0.05, lon / 10 + 0.05, lat / 10 + 0.05
                ).segmentize(0.01)
                area = polygon.intersection(projected(mapping(cell))).area
                if area > 0.01:
                    result.append(
                        Weight(
                            territory.id,
                            f"era5land.{lat / 10:.1f}.{lon / 10:.1f}",
                            lon / 10,
                            lat / 10,
                            area / 1e6,
                            area / polygon.area,
                        )
                    )
        total = sum(w.weight for w in result[start:])
        if abs(total - 1) > 0.0001:
            raise ValueError("Grid intersections do not cover PRA; inspect projection/edges")
        # Tiny numerical projection discrepancies are retained, not hidden.
    return result


def check_administrative_coverage(
    territories: list[Territory], administrative: dict[str, Any]
) -> dict[str, Any]:
    """Independent authoritative departmental boundaries; report discrepancies, never repair."""
    departments = {}
    for feature in administrative["features"]:
        p = feature["properties"]
        if not isinstance(p["department"], str) or p["department"] in departments:
            raise ValueError("Unique official departmental string codes required")
        departments[p["department"]] = (projected(feature["geometry"]), p["region"])
    source = unary_union([g for g, _ in departments.values()])
    union = unary_union([projected(t.geometry) for t in territories])
    outside = 0.0
    hierarchy_mismatches = []
    for t in territories:
        if t.department not in departments or departments[t.department][1] != t.region:
            hierarchy_mismatches.append(t.id)
        else:
            outside += projected(t.geometry).difference(departments[t.department][0]).area
    return {
        "geographic_coverage_rate": union.intersection(source).area / source.area,
        "uncovered_administrative_km2": source.difference(union).area / 1e6,
        "outside_assigned_department_km2": outside / 1e6,
        "hierarchy_mismatches": hierarchy_mismatches,
        "independent_boundary_gap_check": "measured_requires_source_precision_review",
    }
