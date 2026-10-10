"""Separate exploratory descriptive statistics; never scientific risk thresholds."""

import hashlib
import json
import math
from collections import defaultdict
from datetime import date

from .models import DayBatch


def percentiles(
    batches: list[DayBatch],
    start: date,
    end: date,
    probabilities: tuple[float, ...] = (0.1, 0.5, 0.9),
) -> dict[str, object]:
    if (
        end < start
        or not probabilities
        or any(not math.isfinite(p) or not 0 <= p <= 1 for p in probabilities)
    ):
        raise ValueError("Invalid baseline/percentiles")
    groups: dict[tuple[str, str, str, str], list[float]] = defaultdict(list)
    checksums: set[str] = set()
    seen: set[tuple[str, date]] = set()
    excluded = 0
    for batch in batches:
        if not start <= batch.valid_date <= end:
            continue
        identity = batch.source_id, batch.valid_date
        if identity in seen:
            raise ValueError("Duplicate baseline partition")
        seen.add(identity)
        # Historical staleness alone does not invalidate an archived observation.
        if batch.status != "complete":
            excluded += 1
            continue
        checksums.add(batch.provenance.checksum)
        for row in batch.observations:
            if row.value is not None and not row.quality_flags:
                groups[(batch.source_id, row.cell_id, row.variable, row.unit)].append(row.value)
    results = []
    for key, values in sorted(groups.items()):
        values.sort()
        estimates = {}
        for probability in probabilities:
            position = (len(values) - 1) * probability
            lower, upper = math.floor(position), math.ceil(position)
            estimates[str(probability)] = values[lower] + (values[upper] - values[lower]) * (
                position - lower
            )
        results.append(
            dict(zip(("source_id", "cell_id", "variable", "unit"), key))
            | {"sample_count": len(values), "percentiles": estimates}
        )
    return {
        "method_version": "descriptive-linear-1",
        "scientific_status": "exploratory",
        "baseline_from": str(start),
        "baseline_to": str(end),
        "excluded_partitions": excluded,
        "source_checksums": sorted(checksums),
        "input_digest": hashlib.sha256(json.dumps(sorted(checksums)).encode()).hexdigest(),
        "results": results,
    }
