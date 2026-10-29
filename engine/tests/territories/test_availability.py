"""Structural support must never silently renormalize or infer temporal evidence."""

import pytest

from agriclimax.territories.availability import inventory


def example(share):
    reference = {
        "features": [{"properties": {"code": "29102", "name": "Crozon", "department": "29"}}]
    }
    weights = [
        {"pra_id": "pra:29102", "cell_id": cell, "weight": weight}
        for cell, weight in [("coast", share), ("land", 1 - share)]
        if weight > 0
    ]
    return reference, weights


def support(cells):
    return {
        "basis": "verified_native_structural_support",
        "provenance": {"source": "synthetic test"},
        "cells": cells,
    }


def test_temporal_absence_does_not_establish_structural_absence():
    r, w = example(0.2)
    result = inventory(r, w)
    assert result["classification"]["unknown"] == 1
    assert result["rows"][0]["structural_coverage"] is None
    with pytest.raises(ValueError):
        inventory(
            r,
            w,
            {"basis": "single_weather_snapshot", "provenance": "test", "cells": {"coast": False}},
        )


def test_partial_support_keeps_full_area_denominator_and_unknown():
    r, w = example(0.2)
    row = inventory(r, w, support({"land": True}))["rows"][0]
    assert row["structural_coverage"] is None
    assert row["known_structural_area_fraction"] == 0.8
    assert row["unknown_structural_area_fraction"] == pytest.approx(0.2)


@pytest.mark.parametrize(
    ("share", "category"),
    [(0.2, "below_90"), (0.1, "90_to_below_99"), (0.01, "at_least_99"), (1, "zero")],
)
def test_coverage_bins_without_neighbour_fill_or_renormalization(share, category):
    r, w = example(share)
    row = inventory(r, w, support({x["cell_id"]: x["cell_id"] == "land" for x in w}))["rows"][0]
    assert row["structural_coverage"] == pytest.approx(1 - share)
    assert row["category"] == category
