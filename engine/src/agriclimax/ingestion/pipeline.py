"""Daily/backfill runner; failures are isolated per UTC date and safe to replay."""

import hashlib
import json
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from uuid import uuid4

from .models import Provenance
from .normalize import normalize
from .providers import WeatherProvider
from .storage import ObservationRepository, SourceCache, write_manifest


def run(
    provider: WeatherProvider,
    repository: ObservationRepository | None,
    root: Path,
    start: date,
    end: date,
    *,
    dry_run: bool = False,
    max_age: timedelta = timedelta(days=2),
    clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    log: Callable[[str], None] = print,
) -> dict[str, object]:
    if end < start or (end - start).days > 36600 or max_age < timedelta(0):
        raise ValueError("Invalid range (maximum 36601 UTC dates)")
    if not dry_run and repository is None:
        raise ValueError("Persistence required")
    manifest: dict[str, object] = {
        "run_id": str(uuid4()),
        "started_at": clock().isoformat(),
        "source_id": provider.source_id,
        "demo": provider.demo,
        "from": str(start),
        "to": str(end),
        "dry_run": dry_run,
        "days": [],
    }
    results: list[dict[str, object]] = []
    day = start
    while day <= end:
        result: dict[str, object] = {"date": str(day)}
        stage = "download"
        try:
            source = provider.download(day)
            checksum = hashlib.sha256(source.content).hexdigest()
            if not dry_run:
                SourceCache(root / "sources").save(source.content)
            result.update(checksum=checksum, retrieved_at=source.retrieved_at.isoformat())
            stage = "normalize"
            payload = provider.decode(source.content)
            if not isinstance(payload, dict):
                raise TypeError("invalid_envelope")
            published = datetime.fromisoformat(payload["published_at"])
            provenance = Provenance(
                source_id=provider.source_id,
                retrieved_at=source.retrieved_at,
                published_at=published,
                checksum=checksum,
                demo=provider.demo,
            )
            batch = normalize(payload, day, provenance, max_age, clock())
            stage = "persist"
            changed = repository.persist(batch) if repository is not None and not dry_run else False
            result.update(
                status=batch.status,
                freshness=batch.freshness,
                checksum=checksum,
                changed=changed,
                issues=list(batch.issues),
            )
        except Exception as error:  # noqa: BLE001 - isolate failures from provider plugins
            # Deliberately omit exception text, URLs and provider payloads from logs.
            result.update(
                status="invalid" if stage == "normalize" else "error",
                stage=stage,
                error_type=type(error).__name__,
            )
        results.append(result)
        manifest["days"] = results
        log(
            json.dumps(
                {
                    "event": "ingestion_day",
                    "run_id": manifest["run_id"],
                    "source_id": provider.source_id,
                    **result,
                }
            )
        )
        if not dry_run:
            write_manifest(root / "manifests", manifest)
        day += timedelta(days=1)
    manifest["finished_at"] = clock().isoformat()
    manifest["successful"] = all(item["status"] not in {"error", "invalid"} for item in results)
    if not dry_run:
        write_manifest(root / "manifests", manifest)
    return manifest
