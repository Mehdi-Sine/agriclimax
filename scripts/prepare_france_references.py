"""Prepare a bounded calendar reference cache from compact archive rows (no DB writes)."""

import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path

from agriclimax.climate.reference_cache import prepare_calendar
from agriclimax.ingestion.storage import atomic_write


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.input.stat().st_size > 32 * 1024 * 1024:
        parser.error("Input limited to 32 MiB; prepare smaller cell/year partitions")
    content = args.input.read_bytes()
    if args.input.suffix == ".gz":
        with gzip.GzipFile(fileobj=io.BytesIO(content)) as archive:
            decoded = archive.read(32 * 1024 * 1024 + 1)
    else:
        decoded = content
    if len(decoded) > 32 * 1024 * 1024:
        parser.error("Decoded archive limited to 32 MiB")
    payload = json.loads(decoded)
    result = prepare_calendar(payload["rows"] if isinstance(payload, dict) else payload)
    atomic_write(
        args.output,
        json.dumps(
            {
                "archive_sha256": hashlib.sha256(content).hexdigest(),
                "reference_period": "1991-2020",
                "minimum_years": 24,
                "references": result,
            },
            allow_nan=False,
        ).encode(),
    )
    print(
        json.dumps(
            {"prepared_reference_rows": len(result), "persistence": "offline_only"}
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
