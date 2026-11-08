"""Synthetic fixtures are exclusively tests; pilot evidence is acquired separately."""

import gzip
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock
from urllib.error import HTTPError

import pytest
from pydantic import ValidationError

from agriclimax.news.batch import archive, collect, load_registry
from agriclimax.news.feed import canonical, parse_feed, published
from agriclimax.news.matching import match, read_events
from agriclimax.news.models import EditorialNewsBundle, Event, Source
from agriclimax.news.qualify import classify
from agriclimax.news.transport import FetchError, NoRedirect, Response, fetch, validate_url

NOW = datetime(2026, 11, 8, tzinfo=UTC)
SOURCE = Source(
    id="test",
    publisher="Fixture publisher",
    feed_url="https://example.org/rss",
    robots_url="https://example.org/robots.txt",
    allowed_hosts=["example.org"],
    enabled=True,
    rights_url="https://example.org/legal",
    rights_checked_at="2026-11-08",
    rights="etalab-2.0-metadata",
    summary_allowed=True,
    limitation="TEST FIXTURE ONLY",
)


def rss(
    title="Gel sur le blé en Bretagne", url="https://example.org/a", date="2026-11-07T00:00:00Z"
):
    return (
        f"<rss><channel><item><title>{title}</title><link>{url}</link>"
        f"<pubDate>{date}</pubDate><description>Conseils de semis</description>"
        "</item></channel></rss>"
    ).encode()


def registry(*sources):
    return json.dumps(
        {"version": "news-sources-1", "sources": [s.model_dump() for s in sources]}
    ).encode()


def pub(**kwargs):
    return parse_feed(rss(**kwargs), SOURCE, NOW)[0][0]


def event(**kwargs):
    return Event(
        **(
            {
                "id": "event",
                "phenomenon": "frost",
                "region": "Bretagne",
                "period": ("2026-11-08", "2026-11-10"),
                "production_ids": ["wheat"],
                "provenance": ["TEST FIXTURE ONLY"],
            }
            | kwargs
        )
    )


@pytest.mark.parametrize(
    "url",
    [
        "http://example.org/a",
        "https://127.0.0.1/a",
        "https://example.org.evil.test/a",
        "https://user:pass@example.org/a",
        "https://example.org:444/a",
        "https://example.org/a#frag",
        "https://example.org/\na",
        "file:///etc/passwd",
        "https://[::1]/a",
        "https://example.org\\@evil.org/a",
    ],
)
def test_untrusted_urls(url):
    with pytest.raises(ValueError):
        validate_url(url, SOURCE.allowed_hosts)


def test_private_dns_refused(monkeypatch):
    monkeypatch.setattr(
        "socket.getaddrinfo", lambda *a, **k: [(2, 1, 6, "", ("169.254.169.254", 443))]
    )
    with pytest.raises(FetchError, match="non_public"):
        validate_url(SOURCE.feed_url, SOURCE.allowed_hosts, resolve=True)


def test_redirects_never_followed():
    assert NoRedirect().redirect_request(None, None, 302, "", {}, "http://127.0.0.1") is None


@pytest.mark.parametrize(
    "payload",
    [
        b'<!DOCTYPE rss [<!ENTITY a "x">]><rss/>',
        "<!DOCTYPE rss><rss/>".encode("utf-16"),
        b"<html>challenge</html>",
        b"x" * 1_000_001,
    ],
)
def test_unsafe_or_nonfeed_xml(payload):
    with pytest.raises((ValueError, UnicodeError)):
        parse_feed(payload, SOURCE, NOW)


def test_external_link_future_and_missing_title_rejected():
    assert parse_feed(rss(url="https://evil.org/a"), SOURCE, NOW)[1] == 1
    assert parse_feed(rss(date="2027-01-01T00:00:00Z"), SOURCE, NOW)[1] == 1
    assert parse_feed(rss(title=""), SOURCE, NOW)[1] == 1


def test_unknown_timezone_and_tracking():
    assert published("2026-11-07") is None
    assert published("not a date") is None
    assert published("Sat, 07 Nov 2026 10:00:00 +0200").hour == 8
    assert (
        canonical("https://example.org/a?utm_source=x&id=2", SOURCE) == "https://example.org/a?id=2"
    )
    assert pub(date="unknown").published_at is None


def test_atom_and_rdf():
    atom = b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Gel du ble</title><link href="https://example.org/a"/><published>2026-11-07T01:00:00Z</published><category term="Bretagne"/></entry></feed>'
    item = parse_feed(atom, SOURCE, NOW)[0][0]
    assert item.regions == ["Bretagne"] and item.phenomena == ["frost"]
    rdf = b'<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/"><item><title>Gel</title><link>https://example.org/a</link><dc:date>2026-11-07T00:00:00Z</dc:date></item></rdf:RDF>'
    assert parse_feed(rdf, SOURCE, NOW)[0][0].published_at == NOW - timedelta(days=1)


def test_item_cap_and_summary_permission():
    body = (
        b"<rss><channel>"
        + rss().split(b"<channel>")[1].split(b"</channel>")[0] * 251
        + b"</channel></rss>"
    )
    items, _, truncated = parse_feed(body, SOURCE, NOW)
    assert len(items) == 250 and truncated
    restricted = SOURCE.model_copy(update={"summary_allowed": False})
    assert parse_feed(rss(), restricted, NOW)[0][0].summary is None


def test_conservative_classification():
    assert not classify("Mais la pluie arrive à Saint-Martin")["productions"]
    assert not classify("Gel à Saint-Martin")["regions"]
    assert classify("Récolte du maïs en Bretagne")["productions"] == ["maize"]
    assert classify("Recrutement ingénieur")["relevance"] == "rejected"
    assert classify("Lycéens sous la pluie mais contents")["relevance"] == "rejected"
    assert pub().relevance == "high"
    assert classify("Élection du conseil")["relevance"] == "rejected"


def test_all_matching_axes_and_no_science():
    links = match([pub()], [event()])
    assert len(links) == 1 and links[0].relation == "documentary-overlap"
    assert not links[0].scientific_confirmation
    assert not match([pub()], [event(region="Occitanie")])
    assert not match([pub()], [event(production_ids=["cattle"])])
    assert not match([pub()], [event(phenomenon="rain")])
    assert not match([pub(date="2026-09-01T00:00:00Z")], [event()])
    assert not match([pub(date="unknown")], [event()])
    candidate = match([pub(title="Gel en France")], [event()])[0]
    assert candidate.axes["geographic"] == "unknown"
    assert candidate.relation == "documentary-candidate"


def test_independent_failures_robots_and_disabled_sources():
    other = SOURCE.model_copy(update={"id": "other", "feed_url": "https://example.org/other"})
    disabled = SOURCE.model_copy(update={"id": "disabled", "enabled": False})
    calls = []

    def get(url, hosts, **kw):
        calls.append(url)
        if url.endswith("robots.txt"):
            return Response(b"User-agent: *\nAllow: /", 1)
        if url.endswith("rss"):
            raise FetchError("http_503")
        return Response(rss(), 1)

    bundle = collect(registry(SOURCE, other, disabled), now=NOW, fetcher=get)
    assert [s.status for s in bundle.sources] == ["unavailable", "ok", "disabled"]
    assert len(bundle.publications) == 1 and len(calls) == 4
    refused = collect(
        registry(SOURCE),
        now=NOW,
        fetcher=lambda *a, **k: Response(b"User-agent: *\nDisallow: /", 1),
    )
    assert refused.sources[0].error == "robots_disallow"
    expired = collect(registry(SOURCE), now=NOW + timedelta(days=91), fetcher=get)
    assert expired.sources[0].error == "rights_review_expired"


def test_registry_rights_gate():
    with pytest.raises(ValueError, match="permission_required"):
        load_registry(registry(SOURCE.model_copy(update={"rights": "permission-required"})))
    with pytest.raises(ValueError, match="duplicate_source"):
        load_registry(registry(SOURCE, SOURCE))


def test_dedup_republication_revision_and_archive_idempotence(tmp_path):
    body = (
        b"<rss><channel>"
        + b"".join(
            rss(url=u).split(b"<channel>")[1].split(b"</channel>")[0]
            for u in [
                "https://example.org/a",
                "https://example.org/a?utm_source=x",
                "https://example.org/b",
            ]
        )
        + b"</channel></rss>"
    )

    def get(url, hosts, **kw):
        return Response(b"User-agent: *\nAllow: /" if "robots" in url else body, 1)

    bundle = collect(registry(SOURCE), now=NOW, fetcher=get)
    assert {d.kind for d in bundle.duplicates} == {"same-url", "possible-republication"}
    assert len(bundle.publications) == 2
    assert archive(bundle, tmp_path)["new_document_bytes"] > 0
    assert archive(bundle, tmp_path)["new_document_bytes"] == 0
    assert len(list((tmp_path / "receipts").glob("*"))) == 1
    assert pub().id == pub(title="Gel révisé").id
    assert pub().revision != pub(title="Gel révisé").revision
    stored = json.loads(gzip.decompress(next((tmp_path / "publications").glob("*")).read_bytes()))
    assert "collected_at" not in stored
    restored = EditorialNewsBundle.model_validate_json(bundle.model_dump_json())
    assert restored.bundle_id == bundle.bundle_id
    with pytest.raises(ValidationError):
        EditorialNewsBundle.model_validate(bundle.model_dump() | {"unexpected": True})


def test_bounded_transport_retries_and_size(monkeypatch):
    monkeypatch.setattr("agriclimax.news.transport.validate_url", lambda *a, **k: None)
    monkeypatch.setattr("agriclimax.news.transport.time.sleep", lambda *a: None)
    opener = MagicMock()
    opener.open.side_effect = HTTPError(SOURCE.feed_url, 503, "down", {}, None)
    monkeypatch.setattr("agriclimax.news.transport.build_opener", lambda *a: opener)
    with pytest.raises(FetchError, match="503"):
        fetch(SOURCE.feed_url, SOURCE.allowed_hosts)
    assert opener.open.call_count == 2
    opener.open.reset_mock()
    opener.open.side_effect = HTTPError(SOURCE.feed_url, 403, "denied", {}, None)
    with pytest.raises(FetchError, match="403"):
        fetch(SOURCE.feed_url, SOURCE.allowed_hosts)
    assert opener.open.call_count == 1
    opener.open.side_effect = None
    response = opener.open.return_value.__enter__.return_value
    response.headers = {"Content-Length": "1000001"}
    with pytest.raises(FetchError, match="too_large"):
        fetch(SOURCE.feed_url, SOURCE.allowed_hosts)
    response.headers = {"Content-Encoding": "gzip"}
    with pytest.raises(FetchError, match="compressed"):
        fetch(SOURCE.feed_url, SOURCE.allowed_hosts)


def test_real_archive_adapter_is_read_only():
    root = Path(__file__).resolve().parents[3]
    path = root / "docs/codex/agro01/evidence/journal.json"
    body = path.read_bytes()
    events = read_events(body)
    assert events and all(e.provenance for e in events)
    assert body == path.read_bytes()
    with pytest.raises(ValueError):
        read_events(b'{"events": []}')


def test_background_is_separate_and_cannot_confirm():
    publication = pub(date="2026-10-20T00:00:00Z")
    assert not match([publication], [event()])
    background = match([publication], [event()], max_distance_days=30)
    assert len(background) == 1
    assert background[0].relation == "documentary-background"
    assert background[0].temporal_distance_days == 19
    assert not background[0].scientific_confirmation
    with pytest.raises(ValueError):
        match([publication], [event()], max_distance_days=31)


def test_schema_export_is_current():
    root = Path(__file__).resolve().parents[3]
    schema = json.loads((root / "docs/codex/task34/editorial-news-1.schema.json").read_text())
    assert schema == EditorialNewsBundle.model_json_schema()


def test_incomplete_http_response_is_isolated_and_bounded(monkeypatch):
    from http.client import IncompleteRead

    monkeypatch.setattr("agriclimax.news.transport.validate_url", lambda *a, **k: None)
    monkeypatch.setattr("agriclimax.news.transport.time.sleep", lambda *a: None)
    opener = MagicMock()
    opener.open.side_effect = IncompleteRead(b"truncated")
    monkeypatch.setattr("agriclimax.news.transport.build_opener", lambda *a: opener)
    with pytest.raises(FetchError, match="network_unavailable") as error:
        fetch(SOURCE.feed_url, SOURCE.allowed_hosts)
    assert opener.open.call_count == 2 and error.value.attempts == 2


def test_matching_input_and_archive_budgets():
    with pytest.raises(ValueError, match="input_budget"):
        match([pub()], [event()] * 501)
    with pytest.raises(ValueError, match="too_many_event_rows"):
        read_events(json.dumps({"events": [None] * 1001, "source_version": "fixture"}).encode())
