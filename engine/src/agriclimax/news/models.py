"""Versioned T34 contracts, isolated from scientific contracts."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

VERSION: Literal["editorial-news-1"] = "editorial-news-1"
QUALIFIER = "documentary-keywords-1"
DISCLAIMER = "Rapprochement documentaire uniquement ; aucune confirmation scientifique ni dommage PRA déduit."


class Record(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Source(Record):
    id: str = Field(pattern=r"^[a-z0-9-]+$")
    publisher: str
    feed_url: str
    robots_url: str
    allowed_hosts: list[str] = Field(min_length=1, max_length=4)
    enabled: bool
    rights_url: str
    rights_checked_at: str
    rights: Literal["etalab-2.0-metadata", "permission-required"]
    summary_allowed: bool = False
    publisher_region: str | None = None
    content_type: Literal["news", "plant-health-bulletin"] = "news"
    limitation: str


class Publication(Record):
    id: str
    revision: str
    content_fingerprint: str
    source_id: str
    publisher: str
    title: str = Field(max_length=600)
    original_url: str
    canonical_url: str
    published_at: datetime | None
    collected_at: datetime
    author: str | None = None
    categories: list[str]
    summary: str | None = Field(default=None, max_length=600)
    content_type: Literal["news", "plant-health-bulletin", "technical-publication"]
    productions: list[str]
    regions: list[str]
    phenomena: list[str]
    themes: list[str]
    relevance: Literal["high", "context", "rejected"]
    classification_evidence: dict[str, list[str]]
    limitations: list[str]
    qualifier_version: str = QUALIFIER
    feed_sha256: str
    rights_url: str

    @field_validator("published_at", "collected_at")
    @classmethod
    def aware(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("timezone required")
        return value


class SourceResult(Record):
    source_id: str
    status: Literal["ok", "unavailable", "disabled"]
    error: str | None = None
    feed_sha256: str | None = None
    robots_sha256: str | None = None
    bytes_received: int = 0
    attempts: int = 0
    elapsed_seconds: float = 0
    parsed: int = 0
    rejected_entries: int = 0
    truncated: bool = False


class Event(Record):
    id: str
    phenomenon: str
    region: str
    period: tuple[str, str]
    production_ids: list[str]
    provenance: list[str]


class Link(Record):
    publication_id: str
    event_id: str
    axes: dict[str, Literal["match", "unknown", "mismatch"]]
    temporal_distance_days: int
    relation: Literal["documentary-candidate", "documentary-overlap", "documentary-background"]
    scientific_confirmation: Literal[False] = False
    limitation: str = DISCLAIMER


class Duplicate(Record):
    source_id: str
    feed_sha256: str
    publication_id: str
    related_id: str
    kind: Literal["same-url", "possible-republication"]


class EditorialNewsBundle(Record):
    version: Literal["editorial-news-1"] = VERSION
    bundle_id: str
    generated_at: datetime
    registry_sha256: str
    qualifier_version: str = QUALIFIER
    matching_version: Literal["documentary-match-1"] = "documentary-match-1"
    sources: list[SourceResult]
    publications: list[Publication]
    duplicates: list[Duplicate]
    events: list[Event]
    event_archive_sha256: str | None
    links: list[Link]
    background_links: list[Link]
    limitations: list[str]
