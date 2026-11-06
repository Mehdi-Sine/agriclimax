"""National weather orchestration over the existing model/grid/PRA adapters."""

import argparse
import json
from datetime import UTC, date, datetime
from pathlib import Path

from national_weather_sources import Budget, preflight


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=["preflight", "national"], required=True)
    parser.add_argument(
        "--run-date", type=date.fromisoformat, default=datetime.now(UTC).date()
    )
    parser.add_argument("--root", type=Path, default=Path("work/national-weather"))
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--national-authorized", action="store_true")
    parser.add_argument("--publish-dev", action="store_true")
    args = parser.parse_args()
    if not args.execute:
        print(
            json.dumps(
                {
                    "mode": args.mode,
                    "run_date": str(args.run_date),
                    "network": False,
                    "database_write": False,
                }
            )
        )
        return
    run = datetime.combine(args.run_date, datetime.min.time(), UTC)
    budget = Budget()
    if args.mode == "preflight":
        report = preflight(args.root, run, budget)
        print(json.dumps(report))
    else:
        if not args.national_authorized:
            raise ValueError("Explicit national authorization required")
        from national_weather_run import run_national

        result = run_national(args.root, run, budget, args.publish_dev)
        print(json.dumps(result))


if __name__ == "__main__":
    main()
