"""Scientific reconstruction gates on synthetic points; real evidence is documented separately."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from era5_coastal_complement import configuration, estimate, metrics, neighbor_candidates


def test_blocked_pra_exclusion_precedes_neighbor_selection_and_radius():
    points = {
        "own": (0.0, 0.0),
        "west": (-10.0, 0.0),
        "east": (10.0, 0.0),
        "north": (0.0, 10.0),
        "far": (100.0, 100.0),
    }
    near = neighbor_candidates((0.0, 0.0), points, {"own"}, set(points), 25)
    assert {c for _, c in near} == {"west", "east", "north"}
    assert all(c != "own" for _, c in near)


def test_convex_native_neighbor_estimate_requires_three_and_retains_zero_rain():
    config = configuration()
    day = "2026-10-31"
    rows = {
        (c, day): {"temperature": v, "precipitation": 0}
        for c, v in [("a", 10), ("b", 12), ("c", 14)]
    }
    weights = [{"cell_id": "target", "weight": 1}]
    nearby = {"target": [(10, "a"), (10, "b"), (10, "c")]}
    result = estimate(day, "temperature", weights, nearby, rows, config)
    assert result["value"] == 12
    assert abs(sum(result["source_weights"].values()) - 1) < 1e-12
    assert estimate(day, "precipitation", weights, nearby, rows, config)["value"] == 0
    del rows["b", day]
    assert estimate(day, "temperature", weights, nearby, rows, config) is None
    assert estimate(day, "temperature_max", weights, nearby, rows, config) is None


def test_predeclared_metrics_reject_small_or_biased_reference_sets():
    config = configuration()
    checks = [
        {"pra": f"pra:{i % 5}", "error": 0.1, "actual": 10, "maximum_neighbor_distance_m": 20000}
        for i in range(65)
    ]
    assert metrics(checks, "temperature", config)["accepted"]
    assert not metrics(checks[:64], "temperature", config)["accepted"]
    biased = [{**r, "error": 0.6} for r in checks]
    assert not metrics(biased, "temperature", config)["accepted"]
    rainfall = [{**r, "actual": 1, "error": 0.2} for r in checks]
    assert not metrics(rainfall, "precipitation", config)["accepted"]


def test_incremental_refuses_extrapolation_beyond_validated_domain():
    from era5_coastal_complement import reconstruct_days

    config = configuration()
    day = "2026-11-01"
    points = {"target": (0.0, 0.0), "a": (10.0, -1.0), "b": (10.0, 1.0), "c": (20.0, 0.0)}
    groups = {config["target_pra"]: [{"cell_id": "target", "weight": 1}]}
    rows = {(c, day): {"temperature": 10, "precipitation": 0} for c in ["a", "b", "c"]}
    rows["target", day] = {"temperature": None, "precipitation": None}
    validation = {
        "accepted_variables": ["temperature"],
        "pooled": {
            "temperature": {
                "maximum_neighbor_distance_m": 100,
                "maximum_extrapolation_distance_m": 5,
                "maximum_extrapolated_weight_fraction": 1,
            }
        },
    }
    assert reconstruct_days(rows, groups, points, {"a", "b", "c"}, config, validation) == {}
    validation["pooled"]["temperature"]["maximum_extrapolation_distance_m"] = 15
    result = reconstruct_days(rows, groups, points, {"a", "b", "c"}, config, validation)
    assert result[day]["temperature"]["value"] == 10
