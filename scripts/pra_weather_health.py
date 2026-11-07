"""Read-only DEV weather supervision. Never acquires or publishes a source field."""

import json
from datetime import UTC, datetime
from pathlib import Path

from agriclimax.ingestion.storage import atomic_write
from agriclimax.territories.national_weather import validate_document
from agriclimax.territories.weather_archive import decode
from national_weather_models import reference
from pra_weather_store import BUCKET, STORAGE_GUARD, ArchiveStore, indexed_bytes


def fresh_cycle(cycle: datetime, acquired: datetime, now: datetime) -> bool:
    return (0 <= (now - cycle).total_seconds() <= 36 * 3600
            and 0 <= (now - acquired).total_seconds())


def main() -> None:
    store = ArchiveStore(read_only=True)
    catalogue = store.catalogue()
    entries = catalogue["weather"]
    if not entries:
        raise ValueError("No published national cycle")
    entry = max(entries, key=lambda e: str(e.get("run_at", e["run_date"])))
    document = decode(store.blob(entry["path"], entry["sha256"]), entry["sha256"])
    territories, _ = reference()
    validation = validate_document(document, {t.id for t in territories})
    acquired = datetime.fromisoformat(str(document["acquired_at"]))
    cycle = datetime.fromisoformat(document["run"])
    age = (datetime.now(UTC) - cycle).total_seconds() / 3600
    current_raw = store.request(f"object/{BUCKET}/current.json")
    current = json.loads(current_raw) if current_raw else None
    pointer_matches = current is not None and current["weather"] == [entry]
    era_dates = [d for e in catalogue["era5"] for d in e["dates"]]
    era_latest = max(era_dates) if era_dates else None
    era_lag = (datetime.now(UTC).date() - datetime.fromisoformat(era_latest).date()).days if era_latest else None
    total_bytes = indexed_bytes(catalogue)
    result = {
        "checked_at": datetime.now(UTC).isoformat(),
        "run_date": entry["run_date"],
        "published_cycle_at": document["run"],
        "acquired_at": acquired.isoformat(),
        "publication_timestamp": None,  # legacy catalogue does not retain write time
        "acquisition_age_hours": (datetime.now(UTC) - acquired).total_seconds() / 3600,
        "sources": {source: {
            "latest_model_run_at": max(r["model_run_at"] for r in document["rows"] if r["source_id"] == source),
            "latest_acquired_at": max(r["acquired_at"] for r in document["rows"] if r["source_id"] == source),
        } for source in sorted({r["source_id"] for r in document["rows"]})},
        "age_hours": age,
        "freshness_limit_hours": 36,
        "healthy": fresh_cycle(cycle, acquired, datetime.now(UTC)) and pointer_matches and era_lag is not None and 0 <= era_lag <= 7 and total_bytes < STORAGE_GUARD,
        "published_pointer_matches_latest_verified": pointer_matches,
        "era5_latest": era_latest,
        "era5_lag_days": era_lag,
        "indexed_storage_bytes": total_bytes,
        "storage_guard_bytes": STORAGE_GUARD,
        "current_manifest_bytes": len(current_raw or b""),
        "raw_grids_in_supabase": False,
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
