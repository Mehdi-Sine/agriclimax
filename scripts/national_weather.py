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
    report = preflight(args.root, run, Budget())
    print(json.dumps(report))
    if args.mode == "national":
        if (
            not args.national_authorized
            or not report["national_estimate"]["admissible"]
        ):
            raise ValueError(
                "National authorization and admissible measured preflight required"
            )
        raise RuntimeError(
            "National processing not yet implemented; no publication performed"
        )


if __name__ == "__main__":
    main()
