"""Area-based RPG allocation; working geometries only, official PRA snapshot untouched."""
from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from pyproj import Transformer
from shapely import Geometry, make_valid, transform
from shapely.geometry import shape
from shapely.ops import unary_union
from shapely.strtree import STRtree


def polygonal(geometry: Geometry) -> Geometry:
    repaired = make_valid(geometry) if not geometry.is_valid else geometry
    if repaired.geom_type in {"Polygon", "MultiPolygon"}:
        return repaired
    if repaired.geom_type == "GeometryCollection":
        return unary_union([g for g in repaired.geoms if g.geom_type in {"Polygon", "MultiPolygon"}])
    raise ValueError("Expected polygonal agricultural geometry")


def project(geometry: Geometry, source_crs: int) -> Geometry:
    return polygonal(transform(geometry, Transformer.from_crs(source_crs, 3035, always_xy=True).transform, interleaved=False))


@dataclass(frozen=True)
class Allocation:
    hectares: dict[str, float]
    source_ha: float
    accepted_ha: float
    outside_ha: float
    overlap_ha: float
    invalid_geometry: bool


class PraAllocator:
    def __init__(self, features: Sequence[dict]) -> None:
        self.codes = [str(f["properties"]["code"]) for f in features]
        if len(self.codes) != len(set(self.codes)):
            raise ValueError("Duplicate PRA code")
        self.repaired_pra_codes = [self.codes[i] for i, f in enumerate(features) if not shape(f["geometry"]).is_valid]
        self.geometries = [project(shape(f["geometry"]), 4326) for f in features]
        self.tree = STRtree(self.geometries)
        self.transformers: dict[int, Transformer] = {}

    def projected(self, geometry: Geometry, source_crs: int) -> Geometry:
        if source_crs not in self.transformers:
            self.transformers[source_crs] = Transformer.from_crs(source_crs, 3035, always_xy=True)
        return polygonal(transform(geometry, self.transformers[source_crs].transform, interleaved=False))

    def allocate(self, geometry: Geometry, source_crs: int, preceding: Sequence[Geometry] = ()) -> Allocation:
        original = self.projected(geometry, source_crs)
        accepted = original
        # Deterministic first-feature ownership. Record excluded overlaps; never inflate totals.
        overlaps = [self.projected(g, source_crs) for g in preceding if polygonal(geometry).intersects(polygonal(g))]
        if overlaps:
            accepted = original.difference(unary_union(overlaps))
        areas = {}
        for index in self.tree.query(accepted, predicate="intersects"):
            area = accepted.intersection(self.geometries[index]).area / 10000
            if area > 0:
                areas[self.codes[index]] = area
        total = sum(areas.values())
        # One square metre allows only numerical overlay noise, not genuine PRA overlap.
        if total > accepted.area / 10000 + 0.0001:
            raise ValueError("PRA working geometries overlap: allocation would inflate area")
        return Allocation(areas, original.area / 10000, accepted.area / 10000,
                          max(0, accepted.area / 10000 - total),
                          max(0, (original.area - accepted.area) / 10000), not geometry.is_valid)


def gpkg_geometry(blob: bytes) -> Geometry:
    """OGC GeoPackage binary header followed by standard WKB; reject extended encodings."""
    from shapely import from_wkb
    if blob[:2] != b"GP" or blob[2] != 0 or blob[3] & 0b00100000:
        raise ValueError("Unsupported GeoPackage geometry encoding")
    envelope = (blob[3] >> 1) & 7
    sizes = {0: 0, 1: 4, 2: 6, 3: 6, 4: 8}
    if envelope not in sizes:
        raise ValueError("Invalid GeoPackage envelope")
    return from_wkb(blob[8 + 8 * sizes[envelope]:])
