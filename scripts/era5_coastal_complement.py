"""Explicit coastal reconstruction on restored native cells; no acquisition or persistence.

The independently declared method is blocked-PRA validated before its values can
be exposed. Native values and their unavailable state are never overwritten.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import statistics
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from era5_spatial_restitution import native_rows
from pyproj import Transformer
from shapely.geometry import MultiPoint, Point

CONFIG = Path("config/coastal/reconstruction-1.json")
BUNDLE = Path("config/coverage/ofb-masa-pra-2017-snapshot-20261017")
Native = dict[tuple[str, str], dict[str, Any]]
Weights = list[dict[str, Any]]
Points = dict[str, tuple[float, float]]
Nearby = dict[str, list[tuple[float, str]]]


def configuration() -> dict[str, Any]:
    return dict(json.loads(CONFIG.read_text()))


def neighbor_candidates(
    target: tuple[float, float],
    points: Points,
    excluded: set[str],
    valid: set[str],
    radius: float,
) -> list[tuple[float, str]]:
    """Whole-PRA exclusion is applied before the distance ordering, without fitting."""
    x, y = target
    return sorted(
        (math.hypot(x - points[c][0], y - points[c][1]), c)
        for c in valid - excluded
        if abs(x - points[c][0]) <= radius
        and abs(y - points[c][1]) <= radius
        and math.hypot(x - points[c][0], y - points[c][1]) <= radius
    )


def estimate(
    day: str,
    variable: str,
    weights: Weights,
    nearby: Nearby,
    rows: Native,
    config: dict[str, Any],
    points: Points | None = None,
) -> dict[str, Any] | None:
    if variable not in {"temperature", "precipitation"} or not weights:
        return None
    contributions: dict[str, float] = defaultdict(float)
    distances: list[float] = []
    extrapolation_distances: list[float] = []
    extrapolated_weight = 0.0
    total = sum(w["weight"] for w in weights)
    for w in weights:
        selected = [
            (d, c)
            for d, c in nearby[w["cell_id"]]
            if rows.get((c, day), {}).get(variable) is not None
        ][: int(config["neighbors"])]
        if len(selected) < int(config["minimum_neighbors"]):
            return None
        if points is not None:
            outside = MultiPoint([points[c] for _, c in selected]).convex_hull.distance(
                Point(*points[w["cell_id"]])
            )
            extrapolation_distances.append(outside)
            if outside > 1:
                extrapolated_weight += w["weight"] / total
        inv = [1 / max(d, 1) ** int(config["distance_power"]) for d, _ in selected]
        for a, (distance, cell) in zip(inv, selected, strict=True):
            contributions[cell] += w["weight"] / total * a / sum(inv)
            distances.append(distance)
    normalized = {c: float(v) for c, v in sorted(contributions.items())}
    value = sum(
        weight * rows[cell, day][variable] for cell, weight in normalized.items()
    )
    support = hashlib.sha256(
        json.dumps(
            [
                config["method_version"],
                [(c, round(w, 12)) for c, w in normalized.items()],
            ]
        ).encode()
    ).hexdigest()
    return {
        "value": value,
        "support_id": support,
        "source_weights": normalized,
        "maximum_neighbor_distance_m": max(distances),
        "maximum_extrapolation_distance_m": max(extrapolation_distances, default=0.0),
        "extrapolated_weight_fraction": extrapolated_weight,
    }


def metrics(
    checks: list[dict[str, Any]], variable: str, config: dict[str, Any]
) -> dict[str, Any]:
    errors = [float(r["error"]) for r in checks]
    absolute = sorted(abs(v) for v in errors)
    count = len(checks)
    actual_sum = sum(float(r["actual"]) for r in checks)
    result: dict[str, Any] = {
        "PRA": len({r["pra"] for r in checks}),
        "PRA_days": count,
        "bias": statistics.mean(errors) if count else None,
        "MAE": statistics.mean(absolute) if count else None,
        "p95_absolute_error": absolute[math.ceil(count * 0.95) - 1] if count else None,
        "absolute_relative_cumulative_bias": abs(sum(errors)) / actual_sum
        if actual_sum
        else None,
        "maximum_neighbor_distance_m": max(
            (r["maximum_neighbor_distance_m"] for r in checks), default=None
        ),
        "maximum_extrapolation_distance_m": max(
            (r.get("maximum_extrapolation_distance_m", 0) for r in checks), default=None
        ),
        "maximum_extrapolated_weight_fraction": max(
            (r.get("extrapolated_weight_fraction", 0) for r in checks), default=None
        ),
    }
    enough = (
        result["PRA"] >= config["minimum_reference_pra"]
        and count >= config["minimum_reference_pra_days"]
    )
    limits = config["limits"][variable]
    result["accepted"] = bool(
        enough
        and all(
            result[field] is not None and result[field] <= limit
            for field, limit in limits.items()
            if field != "absolute_bias"
        )
        and (
            "absolute_bias" not in limits
            or abs(result["bias"]) <= limits["absolute_bias"]
        )
    )
    return result


def geometry_inputs(
    rows: Native, groups: dict[str, Weights]
) -> tuple[Points, set[str]]:
    project = Transformer.from_crs("EPSG:4326", "EPSG:3035", always_xy=True)
    points = {
        c: project.transform(r["longitude"], r["latitude"])
        for (c, _), r in rows.items()
    }
    for weights in groups.values():
        for w in weights:
            points[w["cell_id"]] = project.transform(w["longitude"], w["latitude"])
    valid = {c for (c, _), r in rows.items() if r["temperature"] is not None}
    return points, valid


def grouped_weights() -> dict[str, Weights]:
    result: dict[str, Weights] = defaultdict(list)
    for w in json.loads((BUNDLE / "weights.json").read_text()):
        result[w["pra_id"]].append(w)
    return result


def validate(
    rows: Native,
    groups: dict[str, Weights],
    points: Points,
    valid: set[str],
    config: dict[str, Any],
    require_30_days: bool,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    all_days = sorted({d for _, d in rows})
    first = config["validation_periods"]["restored"][0]
    eligible = [
        pra
        for pra, weights in groups.items()
        if pra[4:6] in config["reference_departments"]
        and sum(
            w["weight"]
            for w in weights
            if rows.get((w["cell_id"], first), {}).get("temperature") is not None
        )
        >= config["reference_minimum_coverage"]
    ]
    comparisons = []
    rejected = 0
    for pra in eligible:
        weights = groups[pra]
        excluded = {w["cell_id"] for w in weights}
        nearby = {
            w["cell_id"]: neighbor_candidates(
                points[w["cell_id"]], points, excluded, valid, config["radius_m"]
            )
            for w in weights
        }
        for day in all_days:
            for variable in ["temperature", "precipitation"]:
                covered = [
                    w
                    for w in weights
                    if rows.get((w["cell_id"], day), {}).get(variable) is not None
                ]
                coverage = sum(w["weight"] for w in covered)
                if coverage < config["reference_minimum_coverage"]:
                    rejected += 1
                    continue
                predicted = estimate(
                    day, variable, covered, nearby, rows, config, points
                )
                if predicted is None:
                    rejected += 1
                    continue
                actual = (
                    sum(
                        w["weight"] * rows[w["cell_id"], day][variable] for w in covered
                    )
                    / coverage
                )
                comparisons.append(
                    {
                        "pra": pra,
                        "day": day,
                        "variable": variable,
                        "actual": actual,
                        "estimated": predicted["value"],
                        "error": predicted["value"] - actual,
                        "native_coverage": coverage,
                        "maximum_neighbor_distance_m": predicted[
                            "maximum_neighbor_distance_m"
                        ],
                        "maximum_extrapolation_distance_m": predicted[
                            "maximum_extrapolation_distance_m"
                        ],
                        "extrapolated_weight_fraction": predicted[
                            "extrapolated_weight_fraction"
                        ],
                    }
                )
    periods = dict(config["validation_periods"])
    if not require_30_days:
        periods.pop("temporal_holdout")
    summaries = {}
    for label, (start, end) in periods.items():
        expected = {
            str(date.fromisoformat(start) + timedelta(days=i))
            for i in range(
                (date.fromisoformat(end) - date.fromisoformat(start)).days + 1
            )
        }
        if not expected <= set(all_days):
            raise ValueError(
                "Validation period incomplete; no complementary publication"
            )
        summaries[label] = {
            var: metrics(
                [
                    r
                    for r in comparisons
                    if r["variable"] == var and start <= r["day"] <= end
                ],
                var,
                config,
            )
            for var in ["temperature", "precipitation"]
        }
    pooled = {
        var: metrics([r for r in comparisons if r["variable"] == var], var, config)
        for var in ["temperature", "precipitation"]
    }
    accepted = [
        var
        for var in pooled
        if pooled[var]["accepted"]
        and all(p[var]["accepted"] for p in summaries.values())
    ]
    return {
        "eligible_reference_pra": eligible,
        "rejected_pra_day_variable": rejected,
        "periods": summaries,
        "pooled": pooled,
        "accepted_variables": accepted,
        "reference_kind": config["reference_kind"],
        "whole_pra_excluded": True,
        "parameters_fit_to_errors": False,
    }, comparisons


def reconstruct_days(
    rows: Native,
    groups: dict[str, Weights],
    points: Points,
    valid: set[str],
    config: dict[str, Any],
    validation: dict[str, Any],
    verified_zero_dates: set[str] | None = None,
) -> dict[str, Any]:
    weights = groups[config["target_pra"]]
    excluded = {w["cell_id"] for w in weights}
    nearby = {
        w["cell_id"]: neighbor_candidates(
            points[w["cell_id"]], points, excluded, valid, config["radius_m"]
        )
        for w in weights
    }
    output: dict[str, Any] = {}
    for day in sorted({d for _, d in rows}):
        fields = {}
        for variable in validation["accepted_variables"]:
            if not all((w["cell_id"], day) in rows for w in weights) and day not in (
                verified_zero_dates or set()
            ):
                continue
            # A newly recovered native cell would change the premise; retain native data.
            if any(
                rows.get((w["cell_id"], day), {}).get(variable) is not None
                for w in weights
            ):
                continue
            result = estimate(day, variable, weights, nearby, rows, config, points)
            domain = validation["pooled"][variable]["maximum_neighbor_distance_m"]
            if (
                result is None
                or domain is None
                or result["maximum_neighbor_distance_m"] > domain
                or result["maximum_extrapolation_distance_m"]
                > validation["pooled"][variable]["maximum_extrapolation_distance_m"]
                or result["extrapolated_weight_fraction"]
                > validation["pooled"][variable]["maximum_extrapolated_weight_fraction"]
                + 1e-10
            ):
                continue
            fields[variable] = {**result, "native_coverage": 0, "temporal_coverage": 1}
        if fields:
            output[day] = fields
    return output


def build(
    roots: tuple[Path, ...],
    destination: Path,
    evidence: Path,
    *,
    require_30_days: bool = False,
) -> dict[str, Any]:
    config = configuration()
    rows, shas, _ = native_rows(roots)
    groups = grouped_weights()
    points, valid = geometry_inputs(rows, groups)
    validation, comparisons = validate(
        rows, groups, points, valid, config, require_30_days
    )
    validation_sha = hashlib.sha256(
        json.dumps(validation, sort_keys=True).encode()
    ).hexdigest()
    availability_path = Path("docs/codex/verification/task19d/availability.csv")
    historic = next(
        r
        for r in csv.DictReader(availability_path.open())
        if r["pra"] == config["target_pra"]
    )
    if historic["period_state"] != "unavailable" or json.loads(
        historic["maximum_valid_counts_Tmean_Tmin_Tmax_rain"]
    ) != [0, 0, 0, 0]:
        raise ValueError("Original retained native-zero proof does not match Crozon")
    zero_dates = {str(date(2026, 9, 19) + timedelta(days=i)) for i in range(30)}
    document = {
        "native_zero_retained_proof": {
            "path": str(availability_path),
            "sha256": hashlib.sha256(availability_path.read_bytes()).hexdigest(),
            "period": ["2026-09-19", "2026-10-18"],
        },
        "method_plan_sha256": hashlib.sha256(
            Path("docs/codex/task29/COMPLEMENT_METHOD_PLAN.md").read_bytes()
        ).hexdigest(),
        "method_version": config["method_version"],
        "source_id": config["source_id"],
        "scientific_status": "exploratory",
        "rule_version": config["method_version"],
        "data_freshness": "historical_reconstructed",
        "target_pra": config["target_pra"],
        "config_sha256": hashlib.sha256(CONFIG.read_bytes()).hexdigest(),
        "reference_sha256": hashlib.sha256(
            (BUNDLE / "reference.json").read_bytes()
        ).hexdigest(),
        "weights_sha256": hashlib.sha256(
            (BUNDLE / "weights.json").read_bytes()
        ).hexdigest(),
        "native_manifest_sha256": hashlib.sha256(
            json.dumps(sorted(shas)).encode()
        ).hexdigest(),
        "validation_sha256": validation_sha,
        "validation": validation,
        "notice": config["notice"],
        "quality_flags": [
            "spatial_reconstruction_not_native_observation",
            "no_homologous_normal_or_anomaly",
            "validation_relative_to_era5_field_not_station",
        ],
        "days": reconstruct_days(
            rows, groups, points, valid, config, validation, zero_dates
        ),
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(document, separators=(",", ":")))
    evidence.mkdir(parents=True, exist_ok=True)
    (evidence / "complement-validation.json").write_text(
        json.dumps(validation, indent=2)
    )
    if comparisons:
        with (evidence / "complement-validation.csv").open("w") as output:
            writer = csv.DictWriter(output, fieldnames=list(comparisons[0]))
            writer.writeheader()
            writer.writerows(comparisons)
    return {
        "days": len(document["days"]),
        "accepted_variables": validation["accepted_variables"],
        "validation_sha256": validation_sha,
        "bytes": destination.stat().st_size,
    }


def incremental_day(
    root: Path,
    day: str,
    certificate_path: Path = Path("apps/web/data/operational/coastal-complement.json"),
) -> dict[str, Any] | None:
    """Use a frozen validated method; no daily re-fit, new pipeline or source call."""
    config = configuration()
    certificate = json.loads(certificate_path.read_text())
    if (
        certificate["config_sha256"] != hashlib.sha256(CONFIG.read_bytes()).hexdigest()
        or certificate["method_version"] != config["method_version"]
    ):
        return None
    rows, shas, _ = native_rows((root,), day, day)
    if not rows:
        return None
    groups = grouped_weights()
    points, valid = geometry_inputs(rows, groups)
    days = reconstruct_days(
        rows, groups, points, valid, config, certificate["validation"]
    )
    return (
        {
            **{k: v for k, v in certificate.items() if k != "days"},
            "native_manifest_sha256": hashlib.sha256(
                json.dumps(sorted(shas)).encode()
            ).hexdigest(),
            "days": days,
        }
        if days
        else None
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", action="append", type=Path, required=True)
    parser.add_argument(
        "--destination",
        type=Path,
        default=Path("apps/web/data/operational/coastal-complement.json"),
    )
    parser.add_argument(
        "--evidence", type=Path, default=Path("docs/codex/task29/evidence")
    )
    parser.add_argument("--require-30-days", action="store_true")
    args = parser.parse_args()
    print(
        json.dumps(
            build(
                tuple(args.root),
                args.destination,
                args.evidence,
                require_30_days=args.require_30_days,
            )
        )
    )
