"""Two-instant spatial availability probe; not a daily or historical backfill.

Dry-run by default. Fixed scope: T2m/TP, 2026-10-01 and 2026-10-07 at 12 UTC,
metropolitan bounding box, unchanged CDS 0.1 degree grid. No database connection.
"""

import argparse
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path

from agriclimax.climate.era5_land import cds_retrieve

REQUEST = {
    "product_type": "reanalysis",
    "variable": ["2m_temperature", "total_precipitation"],
    "year": "2026",
    "month": "10",
    "day": ["01", "07"],
    "time": ["12:00"],
    "area": [52, -6, 41, 10],
    "data_format": "netcdf",
    "download_format": "unarchived",
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--execute", action="store_true")
    a = parser.parse_args()
    if not a.execute:
        print(
            json.dumps(
                {
                    "writes": False,
                    "downloads": 0,
                    "request_if_executed": REQUEST,
                    "structural_absence_proven": False,
                }
            )
        )
        return
    a.root.mkdir(parents=True, exist_ok=True)
    target, receipt_file = (
        a.root / "native-probe.nc",
        a.root / "native-probe-receipt.json",
    )
    if target.exists() or receipt_file.exists():
        if not target.exists() or not receipt_file.exists():
            raise ValueError(
                "Incomplete probe cache; preserve and inspect before retry"
            )
        previous = json.loads(receipt_file.read_text())
        if (
            previous["request"] != REQUEST
            or previous["sha256"] != hashlib.sha256(target.read_bytes()).hexdigest()
        ):
            raise ValueError("Probe cache identity or checksum conflict")
        print("Verified existing spatial probe; zero downloads")
        return
    cds_retrieve(REQUEST, target)
    receipt = {
        "scope": "Two instants, national spatial availability probe only; no daily aggregation or PostgreSQL import",
        "request": REQUEST,
        "retrieved_at": datetime.now(UTC).isoformat(),
        "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        "bytes": target.stat().st_size,
        "structural_absence_proven": False,
    }
    receipt_file.write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps(receipt))


if __name__ == "__main__":
    main()
