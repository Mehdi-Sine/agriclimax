"""Daily/manual batch, isolated source failures, compact content addressed local archives."""

import gzip
import json
import os
import tempfile
import time
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from urllib.robotparser import RobotFileParser
from xml.etree.ElementTree import ParseError

from .feed import digest, parse_feed
from .matching import match, read_events
from .models import DISCLAIMER, Duplicate, EditorialNewsBundle, Publication, Source, SourceResult
from .transport import USER_AGENT, FetchError, Response, fetch, validate_url

Fetcher = Callable[..., Response]


def load_registry(body: bytes) -> list[Source]:
    data = json.loads(body)
    if data["version"] != "news-sources-1" or not 1 <= len(data["sources"]) <= 10:
        raise ValueError("invalid_registry")
    sources = [Source.model_validate(row) for row in data["sources"]]
    if len({s.id for s in sources}) != len(sources):
        raise ValueError("duplicate_source_id")
    for source in sources:
        validate_url(source.feed_url, source.allowed_hosts)
        validate_url(source.robots_url, source.allowed_hosts)
        if source.enabled and source.rights != "etalab-2.0-metadata":
            raise ValueError("source_permission_required")
    return sources


def collect(
    registry: bytes, *, now: datetime, event_archive: bytes | None = None, fetcher: Fetcher = fetch
) -> EditorialNewsBundle:
    if now.tzinfo is None:
        raise ValueError("timezone required")
    now = now.astimezone(UTC)
    publications: dict[str, Publication] = {}
    results: list[SourceResult] = []
    duplicates: list[Duplicate] = []
    fingerprints: dict[str, str] = {}
    for source in load_registry(registry):
        result = SourceResult(source_id=source.id, status="disabled")
        if not source.enabled:
            result.error = "permission_or_access_pending"
            results.append(result)
            continue
        start = time.monotonic()
        try:
            # Rights review expires after 90 days, before another automated acquisition.
            age = (now.date() - datetime.fromisoformat(source.rights_checked_at).date()).days
            if not 0 <= age <= 90:
                raise FetchError("rights_review_expired")
            robots = fetcher(source.robots_url, source.allowed_hosts, max_bytes=32000)
            result.bytes_received += len(robots.body)
            result.attempts += robots.attempts
            result.robots_sha256 = digest(robots.body)
            parser = RobotFileParser()
            parser.parse(robots.body.decode("utf8").splitlines())
            if not parser.can_fetch(USER_AGENT, source.feed_url):
                raise FetchError("robots_disallow")
            response = fetcher(source.feed_url, source.allowed_hosts)
            result.bytes_received += len(response.body)
            result.attempts += response.attempts
            result.feed_sha256 = digest(response.body)
            pubs, result.rejected_entries, result.truncated = parse_feed(response.body, source, now)
            result.parsed = len(pubs)
            result.status = "ok"
            for pub in pubs:
                if pub.id in publications:
                    duplicates.append(
                        Duplicate(
                            source_id=source.id,
                            feed_sha256=pub.feed_sha256,
                            publication_id=pub.id,
                            related_id=pub.id,
                            kind="same-url",
                        )
                    )
                    continue
                if pub.content_fingerprint in fingerprints:
                    duplicates.append(
                        Duplicate(
                            source_id=source.id,
                            feed_sha256=pub.feed_sha256,
                            publication_id=pub.id,
                            related_id=fingerprints[pub.content_fingerprint],
                            kind="possible-republication",
                        )
                    )
                fingerprints[pub.content_fingerprint] = pub.id
                publications[pub.id] = pub
        except (ValueError, OSError, ParseError) as exc:
            result.status = "unavailable"
            if isinstance(exc, FetchError):
                result.attempts += exc.attempts
            # Stable error only, never log credentials or remote response bodies.
            result.error = str(exc) if isinstance(exc, FetchError) else type(exc).__name__
        result.elapsed_seconds = round(time.monotonic() - start, 3)
        results.append(result)
    pubs = sorted(publications.values(), key=lambda p: p.id)
    events = read_events(event_archive) if event_archive else []
    registry_hash = digest(registry)
    event_hash = digest(event_archive) if event_archive else None
    identity = digest(
        json.dumps(
            [
                "editorial-news-1",
                "documentary-keywords-1",
                "documentary-match-1",
                registry_hash,
                event_hash,
                [(p.id, p.revision) for p in pubs],
                [(r.source_id, r.status, r.feed_sha256, r.error) for r in results],
            ],
            sort_keys=True,
        ).encode()
    )
    return EditorialNewsBundle(
        bundle_id=identity,
        generated_at=now,
        registry_sha256=registry_hash,
        sources=results,
        publications=pubs,
        duplicates=duplicates,
        events=events,
        event_archive_sha256=event_hash,
        links=match(pubs, events),
        background_links=[
            link
            for link in match(pubs, events, max_distance_days=30)
            if link.temporal_distance_days > 14
        ],
        limitations=[
            DISCLAIMER,
            "Métadonnées uniquement ; aucune lecture des articles liés.",
            "Couverture limitée aux éléments présents dans les flux ; absence ≠ absence d’événement.",
            "Rejet lexical provisoire, à contrôler humainement ; republications possibles à relire.",
        ],
    )


def immutable_write(path: Path, body: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Publish a complete file atomically without overwriting an existing object.
    descriptor, temporary = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(body)
            stream.flush()
            os.fsync(stream.fileno())
        try:
            os.link(temporary, path)
        except FileExistsError:
            if path.read_bytes() != body:
                raise ValueError("immutable_archive_conflict") from None
    finally:
        os.unlink(temporary)


def archive(bundle: EditorialNewsBundle, directory: Path) -> dict[str, int]:
    objects = directory / "publications"
    written = 0
    for pub in bundle.publications:
        payload = pub.model_dump(mode="json", exclude={"collected_at", "feed_sha256"})
        body = gzip.compress(
            json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode(),
            mtime=0,
        )
        path = objects / f"{pub.id}.{pub.revision}.json.gz"
        if not path.exists():
            written += len(body)
        immutable_write(path, body)
    # Receipt is small: references to immutable document revisions, no recopy of full history.
    receipt = bundle.model_dump(mode="json", exclude={"publications"})
    receipt["publication_refs"] = [f"{p.id}.{p.revision}" for p in bundle.publications]
    body = gzip.compress(json.dumps(receipt, ensure_ascii=False, sort_keys=True).encode(), mtime=0)
    stamp = bundle.generated_at.strftime("%Y%m%dT%H%M%S%fZ")
    immutable_write(directory / "receipts" / f"{stamp}.{digest(body)}.json.gz", body)
    return {
        "new_document_bytes": written,
        "receipt_bytes": len(body),
        "documents": len(bundle.publications),
    }
