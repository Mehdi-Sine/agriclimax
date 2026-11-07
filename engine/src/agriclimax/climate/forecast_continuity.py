"""Opt-in homogeneous forecast selection; metadata compatibility is not land validation.

Call only on a document verified by the existing archive/schema validator. This
never changes the operational best-model selection or any scientific flags.
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from datetime import date, timedelta

METHOD = "homogeneous-forecast-candidate-1.0.0"


def homogeneous_indices(
    rows: Sequence[Mapping[str, object]],
    pra_ids: set[str],
    variables: set[str],
    start: date,
    end: date,
    *,
    model: str,
    run_at: str,
) -> list[int]:
    if not pra_ids or not variables or end < start or (end - start).days > 6:
        raise ValueError("Explicit PRA, variables and one to seven forecast days required")
    dates = {(start + timedelta(days=i)).isoformat() for i in range((end - start).days + 1)}
    found: dict[tuple[str, str, str], int] = {}
    identities: dict[tuple[str, str], tuple[str, ...]] = {}
    for i, row in enumerate(rows):
        pra, variable, day = (
            str(row.get("pra_id")),
            str(row.get("variable")),
            str(row.get("valid_date")),
        )
        if row.get("model") != model or row.get("model_run_at") != run_at:
            continue
        if pra not in pra_ids or variable not in variables or day not in dates:
            continue
        value = row.get("value")
        coverage = row.get("spatial_coverage")
        if (
            row.get("nature") != "forecast"
            or row.get("status") != "available"
            or row.get("temporal_coverage") != 1
            or isinstance(value, bool)
            or not isinstance(value, (float, int))
            or not math.isfinite(value)
            or not isinstance(coverage, (float, int))
            or not math.isfinite(coverage)
            or not 0.9999 <= coverage <= 1.0001
        ):
            return []
        definition = ("source_id", "grid_version", "weights_sha256", "unit", "rule_version")
        if any(not isinstance(row.get(k), str) or not row[k] for k in definition):
            return []
        identity = tuple(str(row[k]) for k in definition)
        key = pra, variable
        if key in identities and identities[key] != identity:
            return []
        identities[key] = identity
        d = date.fromisoformat(day)
        if (
            row.get("valid_from") != f"{d}T00:00:00Z"
            or row.get("valid_to") != f"{d + timedelta(days=1)}T00:00:00Z"
        ):
            return []
        record_key = pra, variable, day
        if record_key in found:
            return []
        found[record_key] = i
    expected = {(pra, variable, day) for pra in pra_ids for variable in variables for day in dates}
    return sorted(found.values()) if set(found) == expected else []
