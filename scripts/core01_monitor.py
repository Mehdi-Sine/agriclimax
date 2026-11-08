"""Read-only, offline coverage guard for existing workflows; no cron or remote writes."""
from __future__ import annotations

import argparse
import json
from itertools import pairwise
from pathlib import Path
from typing import Any


def compare(current: dict[str, Any], baseline: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    from datetime import date

    def key(c: dict[str, Any]) -> tuple[str, str, str, int]:
        length = (date.fromisoformat(c["period"][1]) - date.fromisoformat(c["period"][0])).days + 1
        return c["usage"], c["indicator"], c["nature"], length

    old = {key(c): c for c in baseline["counts"]}
    for item in current["counts"]:
        item_key = key(item)
        states = item["after"]
        if sum(states.values()) != 713:
            issues.append(f"{item_key}: invalid PRA denominator")
        previous = old.get(item_key)
        if previous:
            for state in ("native_complete", "qualified_estimate", "observed_partial"):
                if states.get(state, 0) < previous["after"].get(state, 0):
                    issues.append(f"{item_key}: coverage drop in {state}")
    if current.get("regressions"):
        issues.append("native values changed")
    dates = current["archive_dates"]
    parsed = [date.fromisoformat(d) for d in dates]
    if any((b-a).days != 1 for a, b in pairwise(parsed)):
        issues.append("discontinuous historical calendar")
    return issues


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("current", type=Path)
    parser.add_argument("--baseline", type=Path, required=True)
    args = parser.parse_args()
    current = json.loads(args.current.read_text())
    issues = compare(current, json.loads(args.baseline.read_text()))
    print(json.dumps({"cycle": current["forecast_run"], "checked_at_source": current["executed_at"],
                      "issues": issues, "editorial_target": "06:30 Europe/Paris"}, indent=2))
    raise SystemExit(1 if issues else 0)


if __name__ == "__main__":
    main()
