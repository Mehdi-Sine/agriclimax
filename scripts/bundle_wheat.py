"""Validate real local portfolio exports and publish the server-only snapshot bundle."""

import argparse
import json
from pathlib import Path

from agriclimax.ingestion.storage import atomic_write
from agriclimax.wheat.models import Portfolio


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, required=True)
    parser.add_argument(
        "--output", type=Path, default=Path("apps/web/features/wheat/snapshots.json")
    )
    args = parser.parse_args()
    portfolios = [
        Portfolio.model_validate_json(f.read_bytes())
        for f in sorted(args.directory.glob("*.json"))
    ]
    if not portfolios or len(portfolios) > 100:
        raise ValueError("1 to 100 real portfolio exports required")
    keys = set()
    for p in portfolios:
        key = (
            p.station_id,
            p.period.start,
            p.period.end,
            p.period.stage,
            p.parameter_fingerprint,
        )
        if key in keys or p.parameters.fingerprint() != p.parameter_fingerprint:
            raise ValueError("Duplicate context or inconsistent parameters")
        keys.add(key)
        for r in p.results:
            if any(s.get("demo") for s in r.provenance):
                raise ValueError("Synthetic data must never enter the real bundle")
    atomic_write(
        args.output,
        json.dumps(
            [p.model_dump(mode="json") for p in portfolios],
            ensure_ascii=False,
            separators=(",", ":"),
            allow_nan=False,
        ).encode()
        + b"\n",
    )
    print(f"Bundled {len(portfolios)} real station/window portfolios")


if __name__ == "__main__":
    main()
