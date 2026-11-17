"""Read-only audit of an existing operational canary; never reacquires a pilot."""
from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import date
from pathlib import Path

from agriclimax.climate.safran_incremental import CandidateStore
from couv03b_checkpoint import validate


def audit(root: Path) -> dict[str, object]:
    manifest = validate(root)
    store = CandidateStore(root)
    days = sorted(manifest["index"]["days"])
    rows = [row for day in days for row in store.read(date.fromisoformat(day))]
    variables = {}
    for variable in sorted({r["variable"] for r in rows}):
        selected = [r for r in rows if r["variable"] == variable]
        variables[variable] = {
            "pra_days": len(selected),
            "pra": len({r["pra_id"] for r in selected}),
            "numeric": sum(r["value"] is not None or r["partial_value"] is not None for r in selected),
            "coverage_min": min(r["spatial_coverage"] for r in selected),
            "coverage_max": max(r["spatial_coverage"] for r in selected),
            "units": sorted({r["unit"] for r in selected}),
            "periods": sorted({r["period"] for r in selected}),
            "states": dict(Counter(r["state"] for r in selected)),
            "validation": sorted({r["scientific_validation"] for r in selected}),
        }
    return {"dates": days, "rows": len(rows), "variables": variables,
            "report": manifest["report"], "remote_writes": 0,
            "public_sim_decision": "NO-GO: technical checks only; source-day qualification required"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    result = audit(args.root)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"dates": result["dates"], "rows": result["rows"], "remote_writes": 0}))


if __name__ == "__main__":
    main()
