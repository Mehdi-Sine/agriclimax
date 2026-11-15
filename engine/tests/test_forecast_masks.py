"""COUV-05 synthetic native fixtures: never presented as real model evidence."""
from dataclasses import dataclass
import pytest
from shapely.geometry import box, mapping, shape
from agriclimax.territories.forecast_masks import NativeProof, combine, qualify, capture_native, read_capture


@dataclass
class Territory:
    id: str
    code: str
    name: str
    department_name: str
    region_name: str
    geometry: dict


@dataclass
class Weight:
    pra_id: str
    cell_id: str
    longitude: float
    latitude: float
    weight: float


def national_fixture():
    territories, weights = [], []
    for n in range(713):
        x, y = 1 + (n % 30) * .3, 41.5 + (n // 30) * .3
        ident = f"pra:{n:05d}"
        territories.append(Territory(ident, f"{n:05d}", f"PRA {n}", "dept", "region",
                                     mapping(box(x-.05, y-.05, x+.05, y+.05))))
        if n == 0:
            territories[0].geometry = mapping(box(x-.05, y-.05, x+.15, y+.05))
            weights.extend([Weight(ident, "arpege.0.0", x, y, .5),
                            Weight(ident, "arpege.0.1", x+.1, y, .5)])
        else:
            weights.append(Weight(ident, f"arpege.{n}", x, y, 1.0))
    return territories, weights


def proof(weights, valid=None):
    return NativeProof("arpege", "2026-11-15T00:00:00+00:00", "2026-11-16",
                       "temperature", "arpege-grid-1", "reference-sha", "weight-sha",
                       None if valid is None else frozenset(valid),
                       frozenset(w.cell_id for w in weights))


def test_713_contours_and_distinct_native_support_states():
    territories, weights = national_fixture()
    known = {w.cell_id for w in weights if w.pra_id not in {"pra:00001", "pra:00002"}}
    known.remove("arpege.0.1")
    rows = qualify(proof(weights, known), territories, weights, make_geometry=False)["rows"]
    lookup = {r["pra_id"]: r for r in rows}
    assert len(rows) == 713
    assert lookup["pra:00000"]["status"] == "partial"
    assert lookup["pra:00000"]["fraction"] == pytest.approx(.5)
    assert lookup["pra:00001"]["status"] == "absent"
    assert lookup["pra:00003"]["status"] == "demonstrated"
    unknown = qualify(proof(weights), territories, weights, make_geometry=False)["rows"]
    assert all(r["status"] == "unknown" and r["support_id"] is None for r in unknown)


def test_partial_geometry_not_extended_to_pra():
    territories, weights = national_fixture()
    doc = qualify(proof(weights, {"arpege.0.0"}), territories, weights)
    features = doc["collection"]["features"]
    assert len(features) == 1 and features[0]["id"] == "pra:00000"
    assert features[0]["properties"]["support_id"] == doc["rows"][0]["support_id"]
    assert 0 < shape(features[0]["geometry"]).area < shape(territories[0].geometry).area


def test_multivariate_multiday_intersection_and_unknown():
    _, weights = national_fixture()
    p = proof(weights, {"arpege.0.0", "arpege.0.1"})
    q = NativeProof(p.model, p.run, "2026-11-17", "humidity", p.grid_version,
                    p.reference_sha256, p.weights_sha256, frozenset({"arpege.0.1"}), p.expected_cells)
    combined = combine([p, q])
    assert combined.valid_cells == {"arpege.0.1"}
    assert combined.date == "2026-11-16..2026-11-17"
    missing = NativeProof(q.model, q.run, q.date, q.variable, q.grid_version,
                          q.reference_sha256, q.weights_sha256, None, q.expected_cells)
    assert combine([p, missing]).valid_cells is None
    with pytest.raises(ValueError, match="Incompatible"):
        combine([p, NativeProof("ifs", q.run, q.date, q.variable, q.grid_version,
                                q.reference_sha256, q.weights_sha256, q.valid_cells, q.expected_cells)])
    with pytest.raises(ValueError, match="Nonconsecutive"):
        combine([p, NativeProof(q.model, q.run, "2026-11-19", q.variable, q.grid_version,
                                q.reference_sha256, q.weights_sha256, q.valid_cells, q.expected_cells)])


def test_native_fraction_cannot_be_inferred_from_aggregate():
    territories, weights = national_fixture()
    agg = {("pra:00000", "temperature"): {"model_run_at": "2026-11-15T00:00:00Z",
           "valid_date": "2026-11-16", "source_id": "meteofrance-arpege", "spatial_coverage": .99}}
    row = qualify(proof(weights, {"arpege.0.0"}), territories, weights,
                  aggregated=agg, make_geometry=False)["rows"][0]
    assert row["status"] == "unknown" and row["support_id"] is None
    assert row["reason"] == "native_fraction_disagrees_with_archive"


def test_foreign_native_cell_rejected():
    territories, weights = national_fixture()
    with pytest.raises(ValueError, match="certified model grid"):
        qualify(proof(weights, {"not-in-grid"}), territories, weights)


def test_native_capture_round_trip_with_variable_specific_missing_cells():
    cells = {"arome.43.000.1.000", "arome.43.025.1.000"}
    values = {v: {c: 1.0 for c in cells} for v in
              ("temperature", "temperature_min", "temperature_max", "precipitation", "humidity")}
    temporal = {v: {c: 1.0 for c in cells} for v in values}
    values["humidity"]["arome.43.025.1.000"] = None
    compressed = capture_native(model="arome", run="2026-11-15T00:00:00+00:00",
                                day="2026-11-16", grid_version="grid",
                                reference_sha256="reference", weights_sha256="weights",
                                values=values, temporal=temporal)
    restored = {p.variable: p for p in read_capture(compressed)}
    assert restored["temperature"].valid_cells == cells
    assert len(restored["humidity"].valid_cells) == 1
    assert restored["temperature"].expected_cells == cells
    with pytest.raises(ValueError, match="Missing variable"):
        capture_native(model="arome", run="cycle", day="2026-11-16", grid_version="grid",
                       reference_sha256="r", weights_sha256="w", values=values,
                       temporal={"temperature": temporal["temperature"]})
