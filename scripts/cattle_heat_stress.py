"""Compute cattle exposure from an existing Task11 station-series JSON export (no writes to DB)."""

import argparse
import json
from datetime import date
from pathlib import Path

from agriclimax.cattle.station import station_exposure
from agriclimax.cattle.thi import export_json, load_rule
from agriclimax.ingestion.models import DayBatch


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--station", required=True)
    parser.add_argument("--from", dest="start", type=date.fromisoformat, required=True)
    parser.add_argument("--to", dest="end", type=date.fromisoformat, required=True)
    parser.add_argument("--resolution", choices=["daily", "hourly"], default="daily")
    parser.add_argument("--rule", type=Path, default=Path("config/cattle/thi-v1.json"))
    args = parser.parse_args()
    payload = json.loads(args.input.read_text())
    rows = payload["data"] if isinstance(payload, dict) else payload
    batches = [
        DayBatch.model_validate(
            {
                k: v
                for k, v in row.items()
                if k not in ("retrieval_freshness", "publication_freshness")
            }
        )
        for row in rows
    ]
    print(
        export_json(
            station_exposure(
                batches,
                load_rule(args.rule),
                station=args.station,
                start=args.start,
                end=args.end,
                resolution=args.resolution,
            )
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
