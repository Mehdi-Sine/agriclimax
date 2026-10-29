"""Explicit edge-case geometries, never an official PRA substitute."""

from dataclasses import asdict

import pytest
from shapely.geometry import MultiPolygon, box, mapping

from agriclimax.territories.spatial import correspondence, load_reference


def document(geometry, code="01001", dep="01", region="84"):
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "code": code,
                    "name": "Synthetic",
                    "department": dep,
                    "department_name": "Synthetic department",
                    "region": region,
                    "region_name": "Synthetic region",
                },
                "geometry": mapping(geometry),
            }
        ],
    }


@pytest.mark.parametrize(
    "geometry,code,dep,region",
    [
        (box(5, 46, 5.01, 46.01), "01001", "01", "84"),  # smaller than a native cell
        (box(5, 46, 5.3, 46.2), "01001", "01", "84"),  # multiple cells
        (box(-4.5, 48.3, -4.25, 48.4), "29001", "29", "53"),  # coast / centres outside
        (box(6.7, 44.5, 6.9, 44.7), "05001", "05", "93"),  # mountain
        (box(9, 42, 9.1, 42.1), "2A001", "2A", "94"),
        (MultiPolygon([box(5, 46, 5.01, 46.01), box(5.1, 46.1, 5.11, 46.11)]), "01001", "01", "84"),
    ],
)
def test_intersections_edges_deterministic(geometry, code, dep, region):
    t, report = load_reference(document(geometry, code, dep, region), version="test")
    w = correspondence(t)
    assert w and abs(sum(x.weight for x in w) - 1) < 0.0001
    assert abs(sum(x.intersection_km2 for x in w) - t[0].area_km2) < 0.0001
    assert [asdict(x) for x in w] == [asdict(x) for x in correspondence(t)]
    assert report["imported_count"] == 1 and not report["count_matches_expected"]
    assert t[0].id == "pra:" + code


def test_no_silent_geometry_repair_or_numeric_code_coercion():
    d = document(box(5, 46, 5.1, 46.1))
    d["features"][0]["properties"]["department"] = 1
    with pytest.raises(ValueError):
        load_reference(d, version="test")
    d = document(box(5, 46, 5.1, 46.1))
    d["features"] *= 2
    with pytest.raises(ValueError):
        load_reference(d, version="test")


def test_overlap_rejected():
    d = document(box(5, 46, 5.1, 46.1))
    second = document(box(5.01, 46.01, 5.11, 46.11), "01002")["features"][0]
    d["features"].append(second)
    with pytest.raises(ValueError, match="overlapping"):
        load_reference(d, version="test")


def test_independent_boundary_audit_measures_gaps_instead_of_fabricating_polygons():
    from agriclimax.territories.spatial import check_administrative_coverage

    t, _ = load_reference(document(box(5, 46, 5.1, 46.1)), version="test")
    independent = {
        "features": [
            {
                "properties": {"department": "01", "region": "84"},
                "geometry": mapping(box(5, 46, 5.2, 46.1)),
            }
        ]
    }
    report = check_administrative_coverage(t, independent)
    assert 0.49 < report["geographic_coverage_rate"] < 0.51
    assert report["uncovered_administrative_km2"] > 0
    assert report["hierarchy_mismatches"] == []
