"""Scientific overlay and statistical-state regressions (synthetic geometries only)."""
import pytest
from pyproj import Transformer
from shapely.geometry import Polygon, box, mapping
from shapely.ops import transform

from agriclimax.agriculture.saa import geography, statistical_value
from agriclimax.agriculture.spatial import PraAllocator


def pra(code, geometry):
    return {"properties": {"code": code}, "geometry": mapping(geometry)}


def test_parcel_across_boundary_conserves_area_not_centroid():
    allocator = PraAllocator([pra("a", box(2, 46, 2.01, 46.01)), pra("b", box(2.01, 46, 2.02, 46.01))])
    result = allocator.allocate(box(2.005, 46.002, 2.015, 46.008), 4326)
    assert result.hectares["a"] > 0
    assert result.hectares["b"] > 0
    assert sum(result.hectares.values()) + result.outside_ha == pytest.approx(result.source_ha)
    assert result.hectares["a"] / result.hectares["b"] == pytest.approx(1, rel=0.001)


def test_corsica_equal_area_crs_and_outside_snapshot():
    allocator = PraAllocator([pra("2A001", box(8.5, 41.8, 8.51, 41.81))])
    parcel = box(8.505, 41.802, 8.515, 41.808)
    to_metric = Transformer.from_crs(4326, 2154, always_xy=True)
    result = allocator.allocate(transform(to_metric.transform, parcel), 2154)
    assert result.hectares["2A001"] > 0
    assert result.outside_ha > 0
    assert result.accepted_ha == pytest.approx(result.source_ha)


def test_invalid_parcel_repaired_and_overlap_accounted():
    allocator = PraAllocator([pra("a", box(1.99, 45.99, 2.03, 46.03))])
    bowtie = Polygon([(2, 46), (2.02, 46.02), (2.02, 46), (2, 46.02), (2, 46)])
    repaired = allocator.allocate(bowtie, 4326)
    assert repaired.invalid_geometry
    assert repaired.source_ha > 0
    parcel = box(2, 46, 2.02, 46.02)
    overlap = allocator.allocate(parcel, 4326, [parcel])
    assert overlap.accepted_ha == 0
    assert overlap.overlap_ha == pytest.approx(overlap.source_ha)


def test_overlapping_pra_cannot_silently_inflate_totals():
    same = box(2, 46, 2.01, 46.01)
    allocator = PraAllocator([pra("a", same), pra("b", same)])
    with pytest.raises(ValueError, match="inflate"):
        allocator.allocate(same, 4326)


def test_statistical_zero_suppression_absence_and_source_anomaly():
    assert statistical_value(0) == (0, "available")
    assert statistical_value("s") == (None, "suppressed")
    assert statistical_value(None) == (None, "unavailable")
    assert statistical_value(-2) == (None, "unavailable")
    with pytest.raises(ValueError):
        statistical_value("new undocumented convention")
    assert geography("02A - Corse-du-Sud", "departement") == ("2A", "Corse-du-Sud")
    assert geography("971 - Guadeloupe", "region") == ("01", "Guadeloupe")
