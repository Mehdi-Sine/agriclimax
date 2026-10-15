"""Pure calendar-window calculations; missing data invalidate the affected aggregate."""

import math
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Literal

from agriclimax.climate.compare import compare_daily
from agriclimax.climate.models import ReferenceDay
from agriclimax.ingestion.models import DayBatch, Observation

from .models import Indicator, Parameters, Portfolio, Window

XCLIM = "https://github.com/Ouranosinc/xclim/blob/v0.58.1/src/xclim/indices/_threshold.py"
ERA5 = "https://doi.org/10.24381/cds.e2161bac"
LIMITS = (
    "Indicateur climatique descriptif, ni risque agronomique ni conseil de conduite.",
    "Seuils exploratoires non universels, non calibres par variete, lieu ou stade.",
    "Point station Météo-France sans interpolation ni couverture continue de la France.",
    "Dates quotidiennes source; aucune deduction de stade ni fenetre biologique automatique.",
    "Confiance faible: absence de validation experte pour le ble, independante de la valeur.",
    "Sequence bornee par la fenetre demandee; aucune continuation hors fenetre deduite.",
)


def runs(values: list[float], predicate: Callable[[float], bool], minimum: int) -> tuple[int, int]:
    lengths: list[int] = []
    length = 0
    for value in values:
        if predicate(value):
            length += 1
        elif length:
            lengths.append(length)
            length = 0
    if length:
        lengths.append(length)
    qualified = [n for n in lengths if n >= minimum]
    return max(qualified, default=0), len(qualified)


def calculate(
    batches: list[DayBatch],
    *,
    station_id: str,
    station_name: str,
    latitude: float,
    longitude: float,
    window: Window,
    parameters: Parameters,
    computed_at: datetime,
    references: list[ReferenceDay] | None = None,
    grid_cell: str | None = None,
    grid_mapping_source: str | None = None,
) -> Portfolio:
    if computed_at.utcoffset() is None:
        raise ValueError("Explicit computation timezone required")
    computed_at = computed_at.astimezone(UTC)
    if window.end >= computed_at.date():
        raise ValueError("Completed historical daily windows only")
    if bool(grid_cell) != bool(grid_mapping_source):
        raise ValueError("An explicit station/grid mapping and its source are both required")
    references = references or []
    if references and (not grid_cell or any(r.cell_id != grid_cell for r in references)):
        raise ValueError("Reference support must match the explicit grid mapping")
    distance = None
    if references:
        ref = references[0]
        delta_lat = math.radians(ref.latitude - latitude)
        delta_lon = math.radians(ref.longitude - longitude)
        a = (
            math.sin(delta_lat / 2) ** 2
            + math.cos(math.radians(latitude))
            * math.cos(math.radians(ref.latitude))
            * math.sin(delta_lon / 2) ** 2
        )
        distance = 6371 * 2 * math.asin(min(1, math.sqrt(a)))
    dates = [window.start + timedelta(days=n) for n in range((window.end - window.start).days + 1)]
    by_date: dict[object, DayBatch] = {}
    for batch in batches:
        if batch.source_id != "meteofrance-climatology" or batch.provenance.demo:
            raise ValueError(
                "Real daily Task 11 climatology required; hourly live samples rejected"
            )
        if batch.valid_date in by_date or not window.start <= batch.valid_date <= window.end:
            raise ValueError("Duplicate or out-of-window daily batch")
        by_date[batch.valid_date] = batch
        seen: set[str] = set()
        for row in batch.observations:
            if (
                row.cell_id != station_id
                or row.temporal_resolution != "daily"
                or row.observed_at.date() != batch.valid_date
                or row.provenance.demo
                or row.provenance.source_id != batch.source_id
                or row.variable in seen
            ):
                raise ValueError("Mixed station/date/source/resolution or duplicate variable")
            seen.add(row.variable)
            if row.variable in {
                "temperature",
                "temperature_min",
                "temperature_max",
                "precipitation",
            }:
                if row.unit != ("mm" if row.variable == "precipitation" else "degC"):
                    raise ValueError("Expected daily degC/mm")
                if row.value is not None and row.value < (
                    0 if row.variable == "precipitation" else -273.15
                ):
                    raise ValueError("Physically invalid value")
    provenance = tuple(
        batch.provenance.model_dump(mode="json")
        | {"station_id": station_id, "valid_date": str(day), "issues": list(batch.issues)}
        for day, batch in sorted(by_date.items())
    )
    freshness: Literal["fresh", "stale", "unknown"] = (
        "unknown"
        if not batches
        else (
            "stale"
            if (
                computed_at - datetime.combine(window.end, datetime.min.time(), UTC)
            ).total_seconds()
            > 172800
            else "fresh"
        )
    )
    results: list[Indicator] = []

    def rows(variable: str) -> list[Observation | None]:
        output: list[Observation | None] = []
        for day in dates:
            batch = by_date.get(day)
            row = (
                next((r for r in batch.observations if r.variable == variable), None)
                if batch
                else None
            )
            output.append(row if batch and batch.status != "invalid" else None)
        return output

    def add(
        name: str,
        variable: str,
        unit: str,
        operation: Callable[[list[float]], float],
        threshold: dict[str, object] | None = None,
        predicate: Callable[[float], bool] | None = None,
        minimum: int = 1,
    ) -> None:
        observations = rows(variable)
        values = [r.value for r in observations if r is not None and r.value is not None]
        complete = len(values) == len(dates)
        quality = {flag for r in observations if r for flag in r.quality_flags}
        if not complete:
            quality.update(("missing_data", "incomplete_window"))
        count = None
        value: float | None
        if predicate and complete:
            value, count = runs(values, predicate, minimum)
        else:
            value = operation(values) if complete else None
        results.append(
            Indicator(
                rule_id=f"wheat.{name}",
                indicator=name,
                period=window,
                value=value,
                unit=unit,
                threshold=threshold,
                freshness=freshness,
                data_freshness=freshness,
                provenance=provenance,
                scientific_sources=(XCLIM,),
                limits=LIMITS,
                quality_flags=tuple(sorted(quality)),
                available_days=len(values),
                expected_days=len(dates),
                sequence_count=count,
            )
        )

    p = parameters
    add(
        "gdd",
        "temperature",
        "degC day",
        lambda v: sum(max(t - p.gdd_base_c, 0) for t in v),
        {"base_c": p.gdd_base_c, "upper_cap": None, "method": "source_daily_mean"},
    )

    def heat(t: float) -> bool:
        return t > p.heat_threshold_c

    def frost(t: float) -> bool:
        return t < p.frost_threshold_c

    def dry(t: float) -> bool:
        return t < p.dry_threshold_mm

    for name, variable, condition, threshold in (
        (
            "heat",
            "temperature_max",
            heat,
            {"operator": ">", "value": p.heat_threshold_c, "unit": "degC"},
        ),
        (
            "frost",
            "temperature_min",
            frost,
            {"operator": "<", "value": p.frost_threshold_c, "unit": "degC"},
        ),
    ):

        def count_days(v: list[float], c: Callable[[float], bool] = condition) -> float:
            return sum(c(t) for t in v)

        add(f"{name}_days", variable, "day", count_days, threshold)
        add(
            f"{name}_spell_max",
            variable,
            "day",
            lambda v: 0,
            threshold | {"minimum_days": p.spell_min_days},
            condition,
            p.spell_min_days,
        )
    add("precipitation_sum", "precipitation", "mm", sum)
    dry_threshold = {"operator": "<", "value": p.dry_threshold_mm, "unit": "mm/day"}
    add("dry_days", "precipitation", "day", lambda v: sum(dry(t) for t in v), dry_threshold)
    add("dry_spell_max", "precipitation", "day", lambda v: 0, dry_threshold, dry)
    for name, variable, unit in (
        ("temperature_anomaly", "temperature", "degC"),
        ("precipitation_anomaly", "precipitation", "mm"),
    ):
        observations = rows(variable)
        comparisons = (
            [
                compare_daily(
                    references,
                    row,
                    cell_id=grid_cell,
                    acknowledge_station_grid_difference=True,
                    computed_at=computed_at,
                )
                for row in observations
                if row is not None
            ]
            if references and grid_cell
            else []
        )
        anomalies = [r.absolute_anomaly for r in comparisons if r.absolute_anomaly is not None]
        support_ok = distance is not None and distance <= p.max_grid_distance_km
        complete = len(anomalies) == len(dates) and support_ok
        flags = {
            "station_grid_support_difference",
            "daily_windows_not_harmonized",
            "not_bias_corrected",
        }
        flags.update(flag for result in comparisons for flag in result.quality_flags)
        if not support_ok:
            flags.add("reference_grid_absent_or_too_far")
        if not complete:
            flags.add("insufficient_reference_or_current_window")
        value = (
            (sum(anomalies) / len(dates) if variable == "temperature" else sum(anomalies))
            if complete
            else None
        )
        results.append(
            Indicator(
                rule_id=f"wheat.{name}",
                indicator=name,
                period=window,
                value=value,
                unit=unit,
                threshold=None,
                freshness=freshness,
                data_freshness=freshness,
                provenance=provenance
                + tuple(
                    {
                        "source_id": "era5-land",
                        "cell_id": r.cell_id,
                        "date": str(r.batch.valid_date),
                        "dataset": r.dataset.model_dump(mode="json"),
                        "checksum": r.batch.provenance.checksum,
                    }
                    for r in references
                ),
                scientific_sources=(ERA5, "Task12 compare_daily / calendar-day-type7-midrank-1"),
                limits=LIMITS
                + (
                    "Comparaison descriptive station/grille non corrigee du biais; fenetres quotidiennes non harmonisees.",
                    "Minimum d'annees Task12 conserve; le smoke test 1991 ne constitue pas une normale 1991-2020.",
                ),
                quality_flags=tuple(sorted(flags)),
                available_days=len(anomalies),
                expected_days=len(dates),
            )
        )
    digest = p.fingerprint()
    return Portfolio(
        station_id=station_id,
        station_name=station_name,
        latitude=latitude,
        longitude=longitude,
        parameters=p,
        parameter_fingerprint=digest,
        period=window,
        grid_cell=grid_cell,
        grid_mapping_source=grid_mapping_source,
        computed_at=computed_at,
        results=tuple(results),
    )
