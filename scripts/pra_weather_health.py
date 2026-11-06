"""Read-only DEV weather supervision. Never acquires or publishes a source field."""

import json
from datetime import UTC, datetime
from pathlib import Path

from agriclimax.ingestion.storage import atomic_write
from agriclimax.territories.national_weather import validate_document
from agriclimax.territories.weather_archive import decode
from national_weather_models import reference
from pra_weather_store import ArchiveStore


def main() -> None:
    store = ArchiveStore(read_only=True)
    entries = store.catalogue()["weather"]
    if not entries:
        raise ValueError("No published national cycle")
    entry = max(entries, key=lambda e: str(e["run_date"]))
    document = decode(store.blob(entry["path"], entry["sha256"]), entry["sha256"])
    territories, _ = reference()
    validation = validate_document(document, {t.id for t in territories})
    acquired = datetime.fromisoformat(str(document["acquired_at"]))
    age = (datetime.now(UTC) - acquired).total_seconds() / 3600
    result = {
        "checked_at": datetime.now(UTC).isoformat(),
        "run_date": entry["run_date"],
        "age_hours": age,
        "freshness_limit_hours": 36,
        "healthy": 0 <= age <= 36,
        "validation": validation,
        "source_requests": 0,
        "storage_writes": store.writes,
        "storage_reads": store.requests,
    }
    atomic_write(Path("work/weather-health/report.json"), json.dumps(result, indent=2).encode())
    print(json.dumps(result))
    if not result["healthy"]:
        raise SystemExit("Published cycle is stale; last valid archive preserved")


if __name__ == "__main__":
    main()
