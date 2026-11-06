"""Independent native-to-PRA arithmetic checks; no production reduction/aggregate calls."""

import math
from collections import defaultdict
from typing import Any

from agriclimax.territories.spatial import Weight


def verify_day(
    rows: list[dict[str, Any]],
    weights: list[Weight],
    temperatures: list[dict[str, float | None]],
    humidities: list[dict[str, float | None]],
    rain: dict[str, float | None],
    rain_factor: float,
) -> dict[str, Any]:
    groups: dict[str, list[Weight]] = defaultdict(list)
    for w in weights:
        groups[w.pra_id].append(w)
    maximum = 0.0
    nulls = 0
    if len(temperatures) != 9 or len(humidities) != 9:
        raise ValueError("Independent 3-hour quadrature requires nine endpoints")
    for row in rows:
        ws = groups[row["pra_id"]]
        valid = []
        for w in ws:
            if row["variable"].startswith("temperature"):
                ts = [d[w.cell_id] for d in temperatures]
                full = [t for t in ts if t is not None]
                value = (
                    None
                    if len(full) != 9
                    else (math.fsum(full[1:8]) + (full[0] + full[8]) / 2) / 8 - 273.15
                    if row["variable"] == "temperature"
                    else min(full[:8]) - 273.15
                    if row["variable"] == "temperature_min"
                    else max(full[:8]) - 273.15
                )
            elif row["variable"] == "humidity":
                hs = [d[w.cell_id] for d in humidities]
                complete = [h for h in hs if h is not None and 0 <= h <= 100]
                value = (
                    None
                    if len(complete) != 9
                    else (math.fsum(complete[1:8]) + (complete[0] + complete[8]) / 2)
                    / 8
                )
            else:
                p = rain[w.cell_id]
                value = None if p is None or p < 0 else p * rain_factor
            if value is not None:
                valid.append((w.weight, value))
        if len(valid) != len(ws):
            if row["value"] is not None:
                raise ValueError("Independent missing-support check failed")
            nulls += 1
        else:
            wanted = (
                min(v for _, v in valid)
                if row["variable"] == "temperature_min"
                else max(v for _, v in valid)
                if row["variable"] == "temperature_max"
                else math.fsum(w * v for w, v in valid) / math.fsum(w for w, _ in valid)
            )
            error = abs(wanted - row["value"])
            maximum = max(maximum, error)
            if error > 1e-9:
                raise ValueError(f"Independent native arithmetic mismatch: {error}")
    return {
        "rows_checked": len(rows),
        "nulls_checked": nulls,
        "max_absolute_difference": maximum,
        "tolerance": 1e-9,
        "production_reduce_or_aggregate_called": False,
    }
