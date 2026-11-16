"""COUV-05 synthetic native fixtures: never presented as real model evidence."""
from dataclasses import dataclass, replace
import pytest
from agriclimax.territories.operational import weight_fingerprint
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
                       "temperature", "arpege-grid-1", "reference-sha", weight_fingerprint(weights),
                       None if valid is None else frozenset(valid),
                       frozenset(w.cell_id for w in weights), "b" * 64)


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
                    p.reference_sha256, p.weights_sha256, frozenset({"arpege.0.1"}), p.expected_cells, "b" * 64)
    combined = combine([p, q], indicator="test-1")
    assert combined.valid_cells == {"arpege.0.1"}
    assert combined.date == "2026-11-16..2026-11-17"
    missing = NativeProof(q.model, q.run, q.date, q.variable, q.grid_version,
                          q.reference_sha256, q.weights_sha256, None, q.expected_cells, "b" * 64)
    assert combine([p, missing], indicator="test-1").valid_cells is None
    with pytest.raises(ValueError, match="Incompatible"):
        combine([p, NativeProof("ifs", q.run, q.date, q.variable, q.grid_version,
                                q.reference_sha256, q.weights_sha256, q.valid_cells, q.expected_cells, "b" * 64)], indicator="test-1")
    with pytest.raises(ValueError, match="Nonconsecutive"):
        combine([p, NativeProof(q.model, q.run, "2026-11-19", q.variable, q.grid_version,
                                q.reference_sha256, q.weights_sha256, q.valid_cells, q.expected_cells, "b" * 64)], indicator="test-1")


def test_native_fraction_cannot_be_inferred_from_aggregate():
    territories, weights = national_fixture()
    agg = {("pra:00000", "temperature"): {"model_run_at": "2026-11-15T00:00:00Z",
           "valid_date": "2026-11-16", "valid_from":"2026-11-16T00:00:00Z",
           "valid_to":"2026-11-17T00:00:00Z", "source_id": "meteofrance-arpege", "spatial_coverage": .99,
           "pra_id":"pra:00000", "variable":"temperature", "grid_version":"arpege-grid-1",
           "rule_version":"pra-national-weather-daily-1",
           "weights_sha256":weight_fingerprint(weights[:2]), "provenance_sha256":"b" * 64, "model":"arpege-0p1"}}
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
                                reference_sha256="reference", weights_sha256="weights", source_sha256="b" * 64,
                                values=values, temporal=temporal)
    restored = {p.variable: p for p in read_capture(compressed)}
    assert restored["temperature"].valid_cells == cells
    assert len(restored["humidity"].valid_cells) == 1
    assert restored["temperature"].expected_cells == cells
    with pytest.raises(ValueError, match="Missing variable"):
        capture_native(model="arome", run="cycle", day="2026-11-16", grid_version="grid",
                       reference_sha256="r", weights_sha256="w", source_sha256="b" * 64, values=values,
                       temporal={"temperature": temporal["temperature"]})


def test_composite_identity_preserves_variable_day_association():
    territories, weights = national_fixture()
    p = proof(weights, {"arpege.0.0"})
    q = replace(p, date="2026-11-17", variable="humidity")
    a = combine([p, q], indicator="recipe-v1")
    b = combine([replace(p, variable="humidity"), replace(q, variable="temperature")], indicator="recipe-v1")
    def ident(item):
        return qualify(item, territories, weights, make_geometry=False)["rows"][0]["support_id"]
    assert ident(a) != ident(b)
    assert ident(a) == ident(combine([q, p], indicator="recipe-v1"))
    assert ident(a) != ident(combine([p, q], indicator="recipe-v2"))
    with pytest.raises(ValueError, match="Duplicate"):
        combine([p, p], indicator="recipe-v1")


def test_geometry_is_verified_above_display_threshold():
    territories, weights = national_fixture()
    # Only the double-width PRA has an exactly matching pair of native footprints.
    territories[0].geometry = mapping(shape(territories[0].geometry).segmentize(.01))
    p = proof(weights, {"arpege.0.0", "arpege.0.1"})
    doc = qualify(p, territories, weights)
    assert doc["rows"][0]["status"] == "demonstrated"
    assert doc["rows"][0]["geometry_verified"]
    assert doc["collection"]["features"][0]["id"] == "pra:00000"
    territories[0].geometry = mapping(box(5, 45, 6, 46))
    with pytest.raises(ValueError, match="geometric intersection"):
        qualify(p, territories, weights)


def test_weight_tampering_and_duplicates_rejected():
    territories, weights = national_fixture()
    p = proof(weights, {"arpege.0.0"})
    changed = [replace(weights[0], longitude=3), *weights[1:]]
    with pytest.raises(ValueError, match="fingerprint"):
        qualify(p, territories, changed, make_geometry=False)
    duplicate = [weights[0], *weights]
    with pytest.raises(ValueError, match="Duplicate"):
        qualify(proof(duplicate, {"arpege.0.0"}), territories, duplicate, make_geometry=False)


def test_nan_archive_fraction_cannot_qualify():
    territories, weights = national_fixture()
    p = proof(weights, {"arpege.0.0"})
    agg = {("pra:00000", "temperature"): {"model_run_at": p.run,
           "valid_date": p.date, "source_id": "meteofrance-arpege", "spatial_coverage": float("nan")}}
    row = qualify(p, territories, weights, aggregated=agg, make_geometry=False)["rows"][0]
    assert row["status"] == "unknown" and row["support_id"] is None


def test_sidecars_are_immutable_and_checked(tmp_path):
    from agriclimax.territories.forecast_mask_store import save, save_index, decode
    territories, weights = national_fixture()
    doc = qualify(proof(weights, {"arpege.0.0"}), territories, weights)
    entry = save(tmp_path, doc)
    assert entry == save(tmp_path, doc)
    index = save_index(tmp_path, [entry], archive_sha256="a" * 64)
    assert index == save_index(tmp_path, [entry], archive_sha256="a" * 64)
    raw = (tmp_path / entry["path"]).read_bytes()
    assert decode(raw, entry["sha256"])["rows"][0]["fraction"] == .5
    with pytest.raises(ValueError, match="checksum"):
        decode(raw + b"broken", entry["sha256"])
    with pytest.raises(ValueError, match="Ambiguous"):
        save_index(tmp_path, [entry, entry], archive_sha256="a" * 64)
    incomplete = qualify(proof(weights, {"arpege.0.0"}), territories, weights, make_geometry=False)
    with pytest.raises(ValueError, match="verified geometry"):
        save(tmp_path, incomplete)
    (tmp_path / entry["path"]).write_bytes(b"corrupted")
    with pytest.raises(ValueError, match="immutable"):
        save(tmp_path, doc)


def test_recipe_requires_every_variable_on_every_day():
    from agriclimax.territories.forecast_masks import combine_required
    _, weights = national_fixture()
    p = proof(weights, {"arpege.0.0"})
    q = replace(p, variable="humidity", valid_cells=frozenset({"arpege.0.1"}))
    r = combine_required([p, q], indicator="thi-v1", variables=["temperature", "humidity"], start=p.date, end=p.date)
    assert r.valid_cells == frozenset()  # Same fractions, disjoint cells: no common support.
    with pytest.raises(ValueError, match="Missing"):
        combine_required([p], indicator="thi-v1", variables=["temperature", "humidity"], start=p.date, end=p.date)
    with pytest.raises(ValueError, match="Missing"):
        combine_required([p, q], indicator="thi-v1", variables=["temperature", "humidity"], start=p.date, end="2026-11-17")


def test_acquisition_provenance_and_cycle_required():
    territories, weights = national_fixture()
    p = proof(weights, {"arpege.0.0"})
    with pytest.raises(ValueError, match="source provenance"):
        qualify(replace(p, source_sha256=""), territories, weights, make_geometry=False)
    with pytest.raises(ValueError, match="UTC"):
        qualify(replace(p, run="2026-11-15T00:00:00"), territories, weights, make_geometry=False)


def test_reduced_checkpoint_does_not_manufacture_native_proof(tmp_path, monkeypatch):
    import gzip
    import json
    from datetime import UTC, date, datetime
    from pathlib import Path
    from types import SimpleNamespace
    from dataclasses import asdict
    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[2] / "scripts"))
    import national_weather_models as models
    _, weights = national_fixture()
    run = datetime(2026, 11, 15, tzinfo=UTC)
    directory = tmp_path / "reduced"
    directory.mkdir()
    saved = {"weights": models.digest([asdict(w) for w in weights]), "run": run.isoformat(),
             "method": models.RULE, "rows": [{"cached": True}], "audit": {"cached": True}}
    raw = gzip.compress(json.dumps(saved).encode())
    path = directory / "arpege-2026-11-16.json.gz"
    path.write_bytes(raw)
    import hashlib
    path.with_suffix(".sha256").write_text(hashlib.sha256(raw).hexdigest())
    monkeypatch.setenv("COUV05_CAPTURE_NATIVE_MASKS", "true")
    def forbidden(*args, **kwargs):
        raise AssertionError("No acquisition or fabricated proof from a reduced cache")
    monkeypatch.setattr(models, "native_field", forbidden)
    rows, _ = models.model_day(SimpleNamespace(product="arpege"), run, date(2026, 11, 16),
                              [], weights, tmp_path, "reference")
    assert rows == [{"cached": True}]
    assert not (tmp_path / "couv05-native").exists()


def test_coastal_touching_lines_do_not_invalidate_proven_polygon_area():
    from shapely.geometry import GeometryCollection, LineString
    from agriclimax.territories.forecast_masks import polygonal_intersection
    polygon = box(1, 45, 1.1, 45.1)
    result = polygonal_intersection(GeometryCollection([polygon, LineString([(2, 45), (2.1, 45.1)])]))
    assert result.equals(polygon) and result.area == polygon.area and result.is_valid


def test_global_and_pra_weight_identities_are_distinct():
    territories, weights = national_fixture()
    p = proof(weights, {"arpege.0.0"})
    row = qualify(p, territories, weights, make_geometry=False)["rows"][0]
    assert row["weights_sha256"] == weight_fingerprint(weights)
    assert row["pra_weights_sha256"] == weight_fingerprint(weights[:2])
    assert row["weights_sha256"] != row["pra_weights_sha256"]


def test_offline_storage_plan_respects_budget_and_archive_binding(tmp_path, monkeypatch):
    from pathlib import Path
    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[2] / "scripts"))
    from couv05_store import plan
    from agriclimax.territories.forecast_mask_store import save, save_index
    territories, weights = national_fixture()
    entry = save(tmp_path, qualify(proof(weights, {"arpege.0.0"}), territories, weights))
    index = save_index(tmp_path, [entry], archive_sha256="a" * 64)
    result = plan(tmp_path, index["sha256"], 8 * 1024**2)
    assert result["archive_sha256"] == "a" * 64 and len(result["objects"]) == 3
    with pytest.raises(ValueError, match="budget"):
        plan(tmp_path, index["sha256"], 1)
    (tmp_path / index["path"]).write_bytes(b"corrupt")
    with pytest.raises(ValueError, match="checksum"):
        plan(tmp_path, index["sha256"], 8 * 1024**2)


def test_utc_serializations_share_one_support_identity():
    territories, weights = national_fixture()
    p = proof(weights, {"arpege.0.0"})
    a = qualify(p, territories, weights, make_geometry=False)["rows"][0]
    b = qualify(replace(p, run=p.run.replace("+00:00", "Z")), territories, weights, make_geometry=False)["rows"][0]
    assert a["support_id"] == b["support_id"]
