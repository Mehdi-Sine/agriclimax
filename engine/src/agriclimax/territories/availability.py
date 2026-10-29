"""Full-area structural support accounting; unknown is never interpreted as absent."""

import math
from collections import defaultdict
from typing import Any


def inventory(
    reference: dict[str, Any], weights: list[dict[str, Any]], support: dict[str, Any] | None = None
) -> dict[str, Any]:
    cells = {w["cell_id"] for w in weights}
    states: dict[str, bool] = {}
    if support is not None:
        if support.get("basis") != "verified_native_structural_support" or not support.get(
            "provenance"
        ):
            raise ValueError("Verified native structural support and provenance required")
        states = support["cells"]
        if not set(states) <= cells or any(type(v) is not bool for v in states.values()):
            raise ValueError("Unknown cell IDs or non-boolean support")
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for w in weights:
        if not math.isfinite(w["weight"]) or w["weight"] <= 0:
            raise ValueError("Invalid weight")
        grouped[w["pra_id"]].append(w)
    rows = []
    bins = dict.fromkeys(["zero", "below_90", "90_to_below_99", "at_least_99", "unknown"], 0)
    for f in reference["features"]:
        p = f["properties"]
        ws = grouped["pra:" + p["code"]]
        if not ws or abs(sum(w["weight"] for w in ws) - 1) > 1e-4:
            raise ValueError("Missing or incomplete full-PRA spatial weights")
        known = sum(w["weight"] for w in ws if w["cell_id"] in states)
        available = sum(w["weight"] for w in ws if states.get(w["cell_id"]) is True)
        complete = all(w["cell_id"] in states for w in ws)
        fraction = min(1.0, available) if complete else None
        category = (
            "unknown"
            if fraction is None
            else "zero"
            if fraction == 0
            else "below_90"
            if fraction < 0.9
            else "90_to_below_99"
            if fraction < 0.99
            else "at_least_99"
        )
        bins[category] += 1
        rows.append(
            {
                "code": p["code"],
                "name": p["name"],
                "department": p["department"],
                "native_cells": len(ws),
                "structural_coverage": fraction,
                "category": category,
                "known_structural_area_fraction": min(1.0, known),
                "unknown_structural_area_fraction": max(0.0, 1 - known),
            }
        )
    return {
        "pra_count": len(rows),
        "native_cells": len(cells),
        "verified_native_support_cells": len(states),
        "classification": bins,
        "interpolation": False,
        "renormalization": False,
        "source": None if support is None else support["provenance"],
        "rows": rows,
    }
