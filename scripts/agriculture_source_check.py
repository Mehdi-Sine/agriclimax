"""Bounded annual catalog availability check; never imports or publishes data."""
import argparse
import hashlib
import json
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

URLS = ["https://www.data.gouv.fr/api/1/datasets/rpg/", "https://agreste.agriculture.gouv.fr/agreste-web/disaron/SAA-SeriesLongues/detail/"]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    records = []
    for url in URLS:
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "AgriclimaX/Task25 official-data-ingestion"})
            with urllib.request.urlopen(request, timeout=30) as response:
                content = response.read(2 * 1024 * 1024 + 1)
                if len(content) > 2 * 1024 * 1024:
                    raise ValueError("Catalog exceeds 2 MiB limit")
                records.append({"url": url, "status": response.status, "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()})
        except (urllib.error.URLError, ValueError):
            records.append({"url": url, "status": "unavailable"})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"checked_at": datetime.now(UTC).isoformat(), "action": "catalog_check_only", "sources": records}, indent=2))
    return int(any(r["status"] != 200 for r in records))


if __name__ == "__main__":
    raise SystemExit(main())
