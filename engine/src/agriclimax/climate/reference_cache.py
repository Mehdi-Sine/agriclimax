"""Prepare compact calendar references offline; no historical bulk database write."""

import math
from collections import defaultdict
from datetime import date

from .statistics import mean, percentile


def number(value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError("Finite numeric reference value required")
    return float(value)


VARIABLES = ("temperature", "temperature_min", "temperature_max", "precipitation")


def prepare_calendar(
    rows: list[dict[str, object]],
    *,
    start_year: int = 1991,
    end_year: int = 2020,
    minimum_years: int = 24,
) -> list[dict[str, object]]:
    """Bounded tile cache, exact calendar day, no fabricated normal or ECDF.

    Counts and null statistics expose incomplete reference periods. February 29
    needs the same declared minimum and therefore remains insufficient with 24.
    Raw samples stay in the archive for exact empirical ranks/homologous periods.
    """
    if not 1950 <= start_year <= end_year or not 2 <= minimum_years <= end_year - start_year + 1:
        raise ValueError("Invalid reference period")
    if len(rows) > 100000:
        raise ValueError("Reference preparation limited to 100000 daily rows per call")
    groups: dict[tuple[str, str], dict[date, dict[str, object]]] = defaultdict(dict)
    seen: set[tuple[str, date]] = set()
    for row in rows:
        day = date.fromisoformat(str(row["valid_date"]))
        key = (str(row["cell_id"]), day)
        if key in seen:
            raise ValueError("Duplicate reference cell/date; choose one explicit dataset revision")
        seen.add(key)
        if start_year <= day.year <= end_year:
            groups[(key[0], day.strftime("%m-%d"))][day] = row
    results = []
    for (cell, month_day), days in sorted(groups.items()):
        samples = [[number(r[v]) for r in days.values() if r.get(v) is not None] for v in VARIABLES]
        enough = [len(s) >= minimum_years for s in samples]
        results.append(
            {
                "cell_id": cell,
                "month_day": month_day,
                "reference_start": start_year,
                "reference_end": end_year,
                "method_version": "calendar-day-type7-1",
                "variables": list(VARIABLES),
                "sample_counts": [len(s) for s in samples],
                "normal": [mean(s) if ok else None for s, ok in zip(samples, enough)],
                **{
                    name: [percentile(s, p) if ok else None for s, ok in zip(samples, enough)]
                    for name, p in [("p10", 0.1), ("p50", 0.5), ("p90", 0.9)]
                },
                "quality_flags": ["exploratory", "calendar_day_reference"]
                + (["insufficient_reference_years"] if not all(enough) else []),
            }
        )
    return results
