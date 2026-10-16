"""Daily live orchestration. Validate the whole acquisition before any DB writes."""

import hashlib
import json
import time
from collections.abc import Callable
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Protocol
from urllib.error import HTTPError, URLError

from agriclimax.cattle.station import station_exposure
from agriclimax.cattle.thi import load_rule
from agriclimax.ingestion.meteofrance import MeteoFranceProvider, Station
from agriclimax.ingestion.models import DayBatch, Provenance
from agriclimax.ingestion.normalize import normalize
from agriclimax.ingestion.providers import SourcePayload
from agriclimax.ingestion.storage import ObservationRepository, atomic_write
from agriclimax.wheat.calculate import calculate
from agriclimax.wheat.models import Parameters, Window


class Provider(Protocol):
    source_id: str
    stations: tuple[Station, ...]

    def prepare(self) -> None: ...
    def download(self, day: date) -> SourcePayload: ...
    def decode(self, content: bytes) -> object: ...


def retry(operation: Callable[[], object], sleep: Callable[[float], None] = time.sleep) -> object:
    """Only transport failures are retried, never validation/authentication errors."""
    for attempt in range(3):
        try:
            return operation()
        except (HTTPError, URLError, TimeoutError, OSError) as error:
            if isinstance(error, HTTPError) and error.code not in {408, 429, 500, 502, 503, 504}:
                raise
            if attempt == 2:
                raise
            sleep(2**attempt)
    raise RuntimeError("Retries exhausted")


def validate(batch: DayBatch, station_ids: tuple[str, ...]) -> None:
    # Optional archive fields may be missing. TM/UM/RR/TN/TX must all be usable
    # for every requested station; never overwrite a valid day with an outage.
    required = {"temperature", "humidity", "precipitation", "temperature_min", "temperature_max"}
    if batch.status in {"invalid", "missing"} or batch.provenance.demo or batch.issues:
        raise ValueError("Invalid daily source")
    if any("station_unavailable" in row.quality_flags for row in batch.observations):
        raise ValueError("Station unavailable")
    for station in station_ids:
        available = {
            row.variable
            for row in batch.observations
            if row.cell_id == station
            and row.value is not None
            and row.temporal_resolution == "daily"
        }
        if not required <= available:
            raise ValueError("Incomplete required station variables")


def run_daily(
    provider: Provider,
    repository: ObservationRepository,
    publish: Callable[[dict[str, object]], object],
    *,
    start: date,
    end: date,
    now: datetime,
    root: Path,
    parameters: Parameters,
    cattle_rule: Path,
) -> bool:
    if now.utcoffset() is None or not 0 <= (end - start).days <= 6 or end >= now.date():
        raise ValueError("One to seven completed UTC days required")
    report: dict[str, object] = {
        "from": str(start),
        "to": str(end),
        "computed_at": now.isoformat(),
        "successful": False,
        "stage": "ingestion",
        "resume": "same_date_range",
    }

    def checkpoint(stage: str) -> None:
        report["stage"] = stage
        atomic_write(root / "logs" / "run.json", json.dumps(report, indent=2).encode())
        # Only fixed stage names and dates, never exception text or source payloads.
        print(json.dumps({"stage": stage, "from": str(start), "to": str(end)}))

    diagnostic: dict[str, str] = {}

    try:
        checkpoint("ingestion")
        diagnostic = {"substage": "prepare"}
        provider.prepare()
        station_ids = tuple(s.id for s in provider.stations)
        if not station_ids:
            raise ValueError("No stations")
        batches = []
        for offset in range((end - start).days + 1):
            day = start + timedelta(days=offset)
            diagnostic = {"substage": "download", "date": day.isoformat()}
            source = provider.download(day)
            diagnostic["substage"] = "decode"
            payload = provider.decode(source.content)
            if not isinstance(payload, dict):
                raise TypeError("Invalid source envelope")
            diagnostic["substage"] = "normalize"
            batch = normalize(
                payload,
                day,
                Provenance(
                    source_id=provider.source_id,
                    retrieved_at=source.retrieved_at,
                    published_at=None,
                    publication_time_known=False,
                    demo=False,
                    checksum=hashlib.sha256(source.content).hexdigest(),
                ),
                timedelta(days=2),
                now,
            )
            diagnostic["substage"] = "validate"
            validate(batch, station_ids)
            batches.append(batch)
        diagnostic = {}
        checkpoint("validated")
        for batch in batches:
            # The existing atomic station RPC is idempotent after uncertain writes.
            repository.persist(batch)
        checkpoint("persisted")
        wheat = [
            calculate(
                batches,
                station_id=s.id,
                station_name=s.name,
                latitude=s.latitude,
                longitude=s.longitude,
                window=Window(start=start, end=end),
                parameters=parameters,
                computed_at=now,
            ).model_dump(mode="json")
            for s in provider.stations
        ]
        checkpoint("wheat")
        rule = load_rule(cattle_rule)
        cattle = [
            station_exposure(batches, rule, station=s.id, start=start, end=end)
            for s in provider.stations
        ]
        checkpoint("cattle")
        snapshot: dict[str, object] = {
            "schema_version": "daily-1",
            "from": str(start),
            "to": str(end),
            "computed_at": now.isoformat(),
            "wheat": wheat,
            "cattle": cattle,
        }
        # Exact publication receipt survives uncertain network writes. Only this
        # non-secret, bounded snapshot is uploaded, never raw HTTP responses.
        atomic_write(root / "snapshot.json", json.dumps(snapshot, allow_nan=False).encode())
        checkpoint("publish")
        retry(lambda: publish(snapshot))
        report["successful"] = True
        checkpoint("complete")
        return True
    except Exception as error:  # noqa: BLE001 - safe CLI boundary, no upstream messages
        # Explicit allowlist: never serialize exceptions, their attributes or tracebacks.
        failure = {**diagnostic, "error_type": type(error).__name__}
        report.update(failure)
        print(json.dumps(failure))
        report["failed_stage"] = report["stage"]
        checkpoint("failed")
        return False


def live_provider(
    stations: tuple[str, ...], start: date, end: date, root: Path
) -> MeteoFranceProvider:
    return MeteoFranceProvider(stations, start, end, cache_root=root / "raw-sources")


def publication_key(snapshot: dict[str, object]) -> str:
    """A source correction changes the key; a new retrieval/compute time does not."""

    def stable(value: object) -> object:
        if isinstance(value, dict):
            return {
                k: stable(v) for k, v in value.items() if k not in {"retrieved_at", "computed_at"}
            }
        if isinstance(value, list):
            return [stable(v) for v in value]
        return value

    return hashlib.sha256(
        json.dumps(
            stable(snapshot), sort_keys=True, separators=(",", ":"), allow_nan=False
        ).encode()
    ).hexdigest()
