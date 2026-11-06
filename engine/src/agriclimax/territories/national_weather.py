"""Shared national model reductions and immutable provider selection, never observations."""

import math
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from itertools import pairwise
from typing import Any, Literal

from .aggregate import Family, aggregate
from .operational import daily_temperature, weight_fingerprint
from .spatial import Territory, Weight
from .weather import PraWeather, WeatherProvenance

RULE = "pra-national-weather-daily-1"
Variable = Literal["temperature", "temperature_min", "temperature_max", "precipitation", "humidity"]
VARIABLES: tuple[Variable, ...] = (
    "temperature",
    "temperature_min",
    "temperature_max",
    "precipitation",
    "humidity",
)
GRID_VERSIONS = {
    "arome": "arome-0p025-centre-footprints-epsg3035-1",
    "arpege": "arpege-0p1-centre-footprints-epsg3035-1",
}


def reduce_native_day(
    temperatures: list[dict[str, float | None]],
    humidities: list[dict[str, float | None]],
    rain: dict[str, float | None],
    steps: list[int],
    rain_factor: float,
) -> tuple[dict[str, dict[str, float | None]], dict[str, dict[str, float]], dict[str, int]]:
    if (
        len(temperatures) != len(steps)
        or len(humidities) != len(steps)
        or steps[-1] - steps[0] != 24
    ):
        raise ValueError("Full daily native support required")
    cells = set(rain)
    if any(set(v) != cells for v in temperatures + humidities):
        raise ValueError("Native grid support changes across variables/times")
    values: dict[str, dict[str, float | None]] = {v: {} for v in VARIABLES}
    coverage: dict[str, dict[str, float]] = {v: {} for v in VARIABLES}
    anomalies = {"negative_precipitation_cells": 0, "out_of_range_humidity_samples": 0}
    for cell in cells:
        ts = [t[cell] for t in temperatures]
        hs = [h[cell] for h in humidities]
        for index, h in enumerate(hs):
            if h is not None and not 0 <= h <= 100:
                anomalies["out_of_range_humidity_samples"] += 1
                hs[index] = None
        mean, low, high = daily_temperature(ts, steps)
        for name, value in zip(VARIABLES[:3], (mean, low, high), strict=True):
            values[name][cell] = value
            coverage[name][cell] = (
                sum(
                    b - a
                    for i, (a, b) in enumerate(pairwise(steps))
                    if ts[i] is not None and ts[i + 1] is not None
                )
                / 24
            )
        complete_h = [h for h in hs if h is not None]
        values["humidity"][cell] = (
            sum(
                (complete_h[i] + complete_h[i + 1]) * (steps[i + 1] - steps[i]) / 48
                for i in range(len(steps) - 1)
            )
            if len(complete_h) == len(steps)
            else None
        )
        coverage["humidity"][cell] = (
            sum(
                b - a
                for i, (a, b) in enumerate(pairwise(steps))
                if hs[i] is not None and hs[i + 1] is not None
            )
            / 24
        )
        p = rain[cell]
        p = None if p is None else p * rain_factor
        if p is not None and p < 0:
            anomalies["negative_precipitation_cells"] += 1
            p = None
        values["precipitation"][cell] = p
        coverage["precipitation"][cell] = 1 if p is not None else 0
    return values, coverage, anomalies


def aggregate_day(
    territories: list[Territory],
    weights: list[Weight],
    model: str,
    run: datetime,
    day: date,
    values: dict[str, dict[str, float | None]],
    temporal: dict[str, dict[str, float]],
    provenance: str,
    acquired_at: datetime,
    recent: bool = False,
) -> list[dict[str, Any]]:
    groups: dict[str, list[Weight]] = defaultdict(list)
    for w in weights:
        groups[w.pra_id].append(w)
    rows = []
    start = datetime.combine(day, datetime.min.time(), UTC)
    end = start + timedelta(days=1)
    for territory in territories:
        ws = groups[territory.id]
        fingerprint = weight_fingerprint(ws)
        for variable in VARIABLES:
            family: Family = (
                "spatial_min"
                if variable == "temperature_min"
                else "spatial_max"
                if variable == "temperature_max"
                else "spatial_mean"
            )
            result = aggregate(ws, values[variable], family)
            flags = (
                *result.quality_flags,
                "model_forecast_not_observation",
                "utc_half_open_day_extrema",
                "source_land_mask_unavailable",
                "land_sea_representativeness_requires_qualification",
                "publication_time_unknown",
            )
            if recent:
                flags += ("retrospective_forecast_model_estimate_not_analysis",)
            if variable.startswith("temperature"):
                flags += ("temperature_sampled_3h_not_continuous",)
            if variable == "humidity":
                flags += (
                    "native_relative_humidity_percent",
                    "out_of_range_samples_invalid_null_not_clamped",
                )
            if variable == "precipitation":
                flags += (
                    "native_24h_interval_verified",
                    "negative_source_precipitation_invalid_null_not_clamped",
                )
            row = PraWeather(
                pra_id=territory.id,
                variable=variable,
                unit="mm"
                if variable == "precipitation"
                else "%"
                if variable == "humidity"
                else "degC",
                value=result.value,
                status=result.status,
                valid_date=day,
                valid_from=start,
                valid_to=end,
                source_id=f"meteofrance-{model}",
                model=f"{model}-0p025" if model == "arome" else f"{model}-0p1",
                nature="forecast",
                model_run_at=run,
                lead_hours=int((end - run).total_seconds() / 3600),
                rule_version=RULE,
                data_freshness="unknown",
                provenance=WeatherProvenance(
                    source_id=f"meteofrance-{model}",
                    checksum=provenance,
                    grid_version=GRID_VERSIONS[model],
                    reference_version="ofb-masa-pra-2017-snapshot-20261017",
                ),
                grid_version=GRID_VERSIONS[model],
                weights_sha256=fingerprint,
                spatial_coverage=min(1, result.valid_weighted_coverage),
                temporal_coverage=min(temporal[variable][w.cell_id] for w in ws),
                quality_flags=flags,
                provenance_sha256=provenance,
                acquired_at=acquired_at,
                published_at=None,
                unavailable_reason="missing_or_invalid_native_support"
                if result.status == "unavailable"
                else None,
                delayed=None,
            )
            rows.append(row.model_dump(mode="json"))
    return rows


def select_daily_sources(
    rows: list[dict[str, Any]], today: date, expected_ids: set[str]
) -> list[int]:
    by_day_source: dict[tuple[str, str], list[int]] = defaultdict(list)
    for index, row in enumerate(rows):
        by_day_source[row["valid_date"], row["source_id"]].append(index)
    selected = []
    for offset in range(-1, 8):
        day = (today + timedelta(days=offset)).isoformat()
        preferred = (
            ["meteofrance-arome", "meteofrance-arpege", "ecmwf-open-data"]
            if offset <= 1
            else ["meteofrance-arpege", "ecmwf-open-data", "meteofrance-arome"]
            if offset <= 3
            else ["ecmwf-open-data", "meteofrance-arpege", "meteofrance-arome"]
        )
        for source in preferred:
            indices = by_day_source.get((day, source), [])
            matrix = {(rows[i]["pra_id"], rows[i]["variable"]) for i in indices}
            if (
                matrix == {(p, v) for p in expected_ids for v in VARIABLES}
                and len(indices) == len(matrix)
                and len({rows[i]["model_run_at"] for i in indices}) == 1
            ):
                selected.extend(indices)
                break
        else:
            raise ValueError(
                f"No complete national identity matrix for {day}; keep previous publication"
            )
    return selected


def compare_sources(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    series = {(r["pra_id"], r["valid_date"], r["variable"], r["source_id"]): r for r in rows}
    result = []
    sources = sorted({r["source_id"] for r in rows})
    for a in sources:
        for b in sources:
            if a >= b:
                continue
            for variable in VARIABLES:
                differences = []
                for (pra, day, var, source), row in series.items():
                    other = series.get((pra, day, var, b))
                    if (
                        source == a
                        and var == variable
                        and other
                        and row["value"] is not None
                        and other["value"] is not None
                    ):
                        differences.append(row["value"] - other["value"])
                if differences:
                    result.append(
                        {
                            "source_a": a,
                            "source_b": b,
                            "variable": variable,
                            "n": len(differences),
                            "bias_a_minus_b": math.fsum(differences) / len(differences),
                            "rmse": math.sqrt(
                                math.fsum(d * d for d in differences) / len(differences)
                            ),
                            "statistical_validation": False,
                        }
                    )
    return result


def validate_document(document: dict[str, Any], expected_ids: set[str]) -> dict[str, Any]:
    """Full source/selected identity matrices, UTC semantics and usable variables."""
    rows = document["rows"]
    if (
        document["pra_count"] != 713
        or len(expected_ids) != 713
        or {r["pra_id"] for r in rows} != expected_ids
    ):
        raise ValueError("National publication requires exactly the 713 official identities")
    for row in rows:
        PraWeather.model_validate(row)
    run = datetime.fromisoformat(document["run"])
    if run.utcoffset() != timedelta(0) or run.hour or run.minute:
        raise ValueError("Reviewed 00 UTC cycle required")
    expected_matrix = {(pra, var) for pra in expected_ids for var in VARIABLES}
    groups: dict[tuple[str, str], list[int]] = defaultdict(list)
    for index, row in enumerate(rows):
        groups[row["source_id"], row["valid_date"]].append(index)
    expected_days = {
        "meteofrance-arome": {-1, 0, 1},
        "meteofrance-arpege": {0, 1, 2, 3},
        "ecmwf-open-data": set(range(1, 8)),
    }
    expected_groups = {
        (source, (run.date() + timedelta(days=offset)).isoformat())
        for source, days in expected_days.items()
        for offset in days
    }
    if set(groups) != expected_groups:
        raise ValueError("Incomplete provider/day matrix; previous valid publication retained")
    for indices in groups.values():
        if (
            len(indices) != len(expected_matrix)
            or {(rows[i]["pra_id"], rows[i]["variable"]) for i in indices} != expected_matrix
        ):
            raise ValueError("Incomplete or duplicate source matrix")
    selected = document["selected_indices"]
    if any(type(i) is not int or not 0 <= i < len(rows) for i in selected) or len(selected) != len(
        set(selected)
    ):
        raise ValueError("Invalid selection pointers")
    selected_rows = [rows[i] for i in selected]
    expected = {
        (pra, (run.date() + timedelta(days=d)).isoformat(), v)
        for pra in expected_ids
        for d in range(-1, 8)
        for v in VARIABLES
    }
    if {(r["pra_id"], r["valid_date"], r["variable"]) for r in selected_rows} != expected or len(
        selected_rows
    ) != len(expected):
        raise ValueError("Incomplete selected national cycle")
    availability = []
    for offset in range(-1, 8):
        day = (run.date() + timedelta(days=offset)).isoformat()
        daily = [r for r in selected_rows if r["valid_date"] == day]
        if len({(r["source_id"], r["model_run_at"]) for r in daily}) != 1:
            raise ValueError("Daily source/run mixing is forbidden")
        for variable in VARIABLES:
            candidates = [r for r in daily if r["variable"] == variable]
            available = sum(r["value"] is not None for r in candidates)
            if available == 0:
                raise ValueError(
                    f"No usable selected {variable} for {day}; retain previous publication"
                )
            availability.append(
                {
                    "date": day,
                    "variable": variable,
                    "available": available,
                    "total": 713,
                    "percent": 100 * available / 713,
                }
            )
    return {
        "source_rows": len(rows),
        "selected_rows": len(selected_rows),
        "pra_count": 713,
        "availability": availability,
    }
