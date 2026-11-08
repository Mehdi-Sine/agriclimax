"""RSS 2, RDF/RSS 1 and Atom metadata only; no linked-article requests."""

import hashlib
import html
import re
from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from xml.etree import ElementTree as ET

from .models import Publication, Source
from .qualify import classify, normalize
from .transport import MAX_BYTES, FetchError, validate_url

MAX_ITEMS = 250


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def clean(text: str, limit: int) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]*>", " ", text))).strip()[:limit]


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def child_text(node: ET.Element, names: tuple[str, ...]) -> str:
    for child in node:
        if local(child.tag) in names:
            return "".join(child.itertext()).strip()
    return ""


def published(text: str) -> datetime | None:
    try:
        value = datetime.fromisoformat(text)
    except ValueError:
        try:
            value = parsedate_to_datetime(text)
        except (ValueError, TypeError, OverflowError):
            return None
    return value.astimezone(UTC) if value.tzinfo else None


def canonical(url: str, source: Source) -> str:
    validate_url(url, source.allowed_hosts)
    p = urlsplit(url)
    query = [
        (k, v)
        for k, v in parse_qsl(p.query, keep_blank_values=True)
        if not k.lower().startswith("utm_") and k.lower() not in ("fbclid", "gclid")
    ]
    return urlunsplit(("https", p.hostname or "", p.path or "/", urlencode(sorted(query)), ""))


def parse_feed(body: bytes, source: Source, now: datetime) -> tuple[list[Publication], int, bool]:
    if len(body) > MAX_BYTES:
        raise FetchError("response_too_large")
    text = body.decode("utf-8-sig")
    if len(body) > MAX_BYTES or re.search(r"<!\s*(DOCTYPE|ENTITY)", text, re.IGNORECASE):
        raise FetchError("unsafe_xml")
    root = ET.fromstring(text)
    if local(root.tag) not in ("rss", "RDF", "feed"):
        raise FetchError("not_a_feed")
    entries = [e for e in root.iter() if local(e.tag) in ("item", "entry")]
    output: list[Publication] = []
    rejected = 0
    for entry in entries[:MAX_ITEMS]:
        title = clean(child_text(entry, ("title",)), 600)
        url = child_text(entry, ("link",))
        if local(root.tag) == "feed":
            url = next(
                (
                    e.attrib.get("href", "")
                    for e in entry
                    if local(e.tag) == "link" and e.attrib.get("rel", "alternate") == "alternate"
                ),
                "",
            )
        try:
            canon = canonical(url, source)
        except ValueError:
            rejected += 1
            continue
        if not title:
            rejected += 1
            continue
        date = published(child_text(entry, ("pubDate", "published", "date")))
        if date and date > now + timedelta(days=1):
            rejected += 1
            continue
        categories = [
            clean(e.attrib.get("term", "") or "".join(e.itertext()), 120)
            for e in entry
            if local(e.tag) in ("category", "subject")
        ][:20]
        summary = (
            clean(child_text(entry, ("description", "summary")), 600)
            if source.summary_allowed
            else None
        )
        author = clean(child_text(entry, ("author", "creator")), 160) or None
        fields = classify(" ".join([title, *categories, summary or ""]))
        limitations = [
            source.limitation,
            "Classement lexical, contexte et causalité non vérifiés.",
            "Date de publication distincte de la période du phénomène.",
        ]
        if date is None:
            limitations.append("Date de publication absente ou fuseau inconnu.")
        if not fields["regions"]:
            limitations.append(
                "Localisation documentaire inconnue ; région de l’éditeur non imputée."
            )
        if fields["relevance"] == "rejected":
            limitations.append("Aucun indice agroclimatique dans les métadonnées autorisées.")
        payload = "\n".join(
            [
                canon,
                title,
                date.isoformat() if date else "",
                author or "",
                "|".join(categories),
                summary or "",
            ]
        )
        output.append(
            Publication(
                id=digest(canon.encode()),
                revision=digest(
                    (payload + source.model_dump_json() + "documentary-keywords-1").encode()
                ),
                content_fingerprint=digest(normalize(title).encode()),
                source_id=source.id,
                publisher=source.publisher,
                title=title,
                original_url=url,
                canonical_url=canon,
                published_at=date,
                collected_at=now,
                author=author,
                categories=categories,
                summary=summary,
                content_type=source.content_type,
                **fields,
                limitations=limitations,
                feed_sha256=digest(body),
                rights_url=source.rights_url,
            )
        )
    return output, rejected, len(entries) > MAX_ITEMS
