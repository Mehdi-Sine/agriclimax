"""Independent documentary matching service, not a climate rule."""

import json
from datetime import date
from typing import Literal

from .models import Event, Link, Publication


def read_events(body: bytes) -> list[Event]:
    """Adapter for archived JournalEdition or WatchSummary. Never invent an event."""
    if len(body) > 8_000_000:
        raise ValueError("event_archive_too_large")
    data = json.loads(body)
    if "edition_id" in data:
        rows = [
            data.get("main_story"),
            *data.get("secondary_stories", []),
            *(e for r in data.get("regional_sections", []) for e in r.get("events", [])),
        ]
        provenance = data.get("provenance", []) + [data["edition_id"]]
    elif "events" in data and "source_version" in data:
        rows = data["events"]
        provenance = [data["source_version"]]
    else:
        raise ValueError("unsupported_event_archive")
    if len(rows) > 1000:
        raise ValueError("too_many_event_rows")
    events: dict[str, Event] = {}
    for row in rows:
        if not row:
            continue
        period = row.get("period") or [row["start"], row["end"]]
        start, end = (date.fromisoformat(d) for d in period)
        if start > end:
            raise ValueError("invalid_event_period")
        events[row["id"]] = Event(
            id=row["id"],
            phenomenon=row["phenomenon"],
            region=row["region"],
            period=(str(start), str(end)),
            production_ids=row["production_ids"],
            provenance=list(
                dict.fromkeys(provenance + row.get("provenance", []) + row.get("evidence_ids", []))
            ),
        )
    return sorted(events.values(), key=lambda e: e.id)


def match(
    publications: list[Publication], events: list[Event], *, max_distance_days: int = 14
) -> list[Link]:
    if not 0 <= max_distance_days <= 30:
        raise ValueError("invalid_documentary_window")
    if len(publications) > 2500 or len(events) > 500:
        raise ValueError("matching_input_budget")
    links: list[Link] = []
    for pub in publications:
        if pub.published_at is None or pub.relevance == "rejected":
            continue
        for event in events:
            start, end = (date.fromisoformat(d) for d in event.period)
            day = pub.published_at.date()
            distance = max((start - day).days, (day - end).days, 0)
            if distance > max_distance_days or event.phenomenon not in pub.phenomena:
                continue

            def axis(
                known: list[str], expected: list[str]
            ) -> Literal["match", "unknown", "mismatch"]:
                return (
                    "unknown"
                    if not known or not expected
                    else ("match" if set(known) & set(expected) else "mismatch")
                )

            axes: dict[str, Literal["match", "unknown", "mismatch"]] = {
                "temporal": "match",
                "geographic": axis(pub.regions, [event.region]),
                "production": axis(pub.productions, event.production_ids),
                "phenomenon": "match",
                "thematic": "match" if "agroclimate" in pub.themes else "unknown",
            }
            if "mismatch" in axes.values():
                continue
            if len(links) >= 10000:
                raise ValueError("matching_link_budget")
            links.append(
                Link(
                    publication_id=pub.id,
                    event_id=event.id,
                    axes=axes,
                    temporal_distance_days=distance,
                    relation="documentary-background"
                    if distance > 14
                    else "documentary-overlap"
                    if all(v == "match" for v in axes.values())
                    else "documentary-candidate",
                )
            )
    return sorted(links, key=lambda link: (link.event_id, link.publication_id))
