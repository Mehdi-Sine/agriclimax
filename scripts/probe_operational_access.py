"""Bounded read-only access probe; product credentials never enter reports or URLs."""

import gzip
import hashlib
import io
import json
import os
import struct
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from pathlib import Path
from time import monotonic
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, build_opener

from agriclimax.ingestion.meteofrance import NoRedirect

ORIGIN = "https://public-api.meteofrance.fr/public/"
MODELS = {
    "arome": (
        "arome/1.0/wcs/MF-NWP-HIGHRES-AROME-0025-FRANCE-WCS/",
        "METEOFRANCE_AROME_API_KEY",
    ),
    "arpege": (
        "arpege/1.0/wcs/MF-NWP-GLOBAL-ARPEGE-01-EUROPE-WCS/",
        "METEOFRANCE_ARPEGE_API_KEY",
    ),
}
CATALOGUE_LIMIT = 1_500_000
# WCS lists many variables and retained model runs; this is XML, never field data.
METADATA_LIMIT = 16 * 1024 * 1024
FIELD_LIMIT = 262_144


def fetch(url: str, variable: str, limit: int) -> tuple[dict[str, object], bytes]:
    started = monotonic()
    record: dict[str, object] = {
        "url": url,
        "credential_binding": variable,
        "status": "binding_absent",
    }
    content = b""
    key = os.environ.get(variable, "").strip()
    if key:
        try:
            request = Request(url, headers={"apikey": key, "Accept-Encoding": "gzip"})
            with build_opener(NoRedirect()).open(request, timeout=20) as response:
                record["status"] = response.status
                record["content_type"] = response.headers.get("Content-Type", "")
                length = response.headers.get("Content-Length")
                encoding = response.headers.get("Content-Encoding", "identity").lower()
                wire_limit = (
                    min(limit, 2 * 1024 * 1024) if encoding == "gzip" else limit
                )
                record["content_encoding"] = encoding
                if length is not None:
                    record["declared_wire_bytes"] = int(length)
                if length is not None and int(length) > wire_limit:
                    record["outcome"] = "response_budget_exceeded"
                else:
                    content = response.read(wire_limit + 1)
                    wire_bytes = len(content)
                    record["wire_bytes_read"] = wire_bytes
                    if len(content) <= wire_limit and encoding == "gzip":
                        with gzip.GzipFile(fileobj=io.BytesIO(content)) as zipped:
                            content = zipped.read(limit + 1)
                    if len(content) > limit or wire_bytes > wire_limit:
                        record["outcome"] = "response_budget_exceeded"
                        content = b""
                    elif key.encode() in content:
                        record["outcome"] = "credential_echo_rejected"
                        content = b""
                    else:
                        record["outcome"] = "received"
        except HTTPError as error:
            record["status"] = error.code
            error.close()  # No response/error text or redirect target is logged.
        except (URLError, OSError, TimeoutError, ValueError, EOFError):
            record["outcome"] = "network_or_response_error"
            content = b""
    record.update(bytes=len(content), seconds=monotonic() - started)
    return record, content


def xml_root(content: bytes) -> ET.Element:
    if b"<!DOCTYPE" in content.upper() or b"<!ENTITY" in content.upper():
        raise ValueError("XML declarations not accepted")
    return ET.fromstring(content)


def capabilities(content: bytes) -> list[str]:
    root = xml_root(content)
    if root.tag.rsplit("}", 1)[-1] != "Capabilities":
        raise ValueError("Not WCS capabilities")
    ids = [
        e.text.strip() for e in root.iter() if e.tag.endswith("}CoverageId") and e.text
    ]
    if not ids:
        raise ValueError("No advertised coverages")
    return list(dict.fromkeys(ids))


def field_parameters(content: bytes) -> tuple[list[tuple[str, str]], dict[str, object]]:
    """Use advertised axes/time only; refuse an unconstrained extra dimension."""
    root = xml_root(content)
    if root.tag.rsplit("}", 1)[-1] != "CoverageDescriptions":
        raise ValueError("Not WCS coverage descriptions")
    envelope = next(
        e for e in root.iter() if "axisLabels" in e.attrib and "Envelope" in e.tag
    )
    axes = envelope.attrib["axisLabels"].split()
    lower = next(e.text for e in envelope if e.tag.endswith("}lowerCorner"))
    upper = next(e.text for e in envelope if e.tag.endswith("}upperCorner"))
    if not lower or not upper:
        raise ValueError("Missing bounds")
    lows, highs = lower.split(), upper.split()
    if len(lows) != len(axes) or len(highs) != len(axes):
        raise ValueError("Ambiguous axes")
    subsets = []
    selected: dict[str, object] = {}
    found = set()
    for axis, low, high in zip(axes, lows, highs, strict=True):
        kind = axis.lower()
        if kind in {"lat", "latitude"}:
            a, b = 48.0, 48.1
            found.add("latitude")
        elif kind in {"long", "lon", "longitude"}:
            a, b = 1.4, 1.5
            found.add("longitude")
        elif kind == "time":
            when = datetime.fromisoformat(low)
            if when.tzinfo is None:
                raise ValueError("Time without timezone")
            subsets.append(("subset", f'{axis}("{low}")'))
            selected[axis] = low
            found.add("time")
            continue
        elif kind in {"height", "height_above_ground"}:
            a = b = 2.0
        else:
            raise ValueError("Unsupported axis; no field requested")
        if not float(low) <= a <= b <= float(high):
            raise ValueError("Pilot slice outside advertised bounds")
        subsets.append(
            ("subset", f"{axis}({a:g},{b:g})" if a != b else f"{axis}({a:g})")
        )
        selected[axis] = [a, b] if a != b else a
    if found != {"latitude", "longitude", "time"}:
        raise ValueError("Required dimensions missing")
    return subsets, selected


def tiff_dimensions(content: bytes) -> tuple[int, int]:
    """Validate classic TIFF dimensions before retaining the tiny field."""
    if content[:4] not in {b"II*\x00", b"MM\x00*"}:
        raise ValueError("Not a classic TIFF field")
    endian = "<" if content[:2] == b"II" else ">"
    offset = struct.unpack_from(endian + "I", content, 4)[0]
    count = struct.unpack_from(endian + "H", content, offset)[0]
    dimensions = {}
    for index in range(count):
        pos = offset + 2 + 12 * index
        tag, kind, size = struct.unpack_from(endian + "HHI", content, pos)
        if tag in {256, 257} and kind in {3, 4} and size == 1:
            dimensions[tag] = struct.unpack_from(
                endian + ("H" if kind == 3 else "I"), content, pos + 8
            )[0]
    width, height = dimensions[256], dimensions[257]
    if not 0 < width * height <= 100:
        raise ValueError("Field grid exceeds pilot budget")
    return width, height


def probe(root: Path) -> list[dict[str, object]]:
    root.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, object]] = []
    model_ids: dict[str, list[str]] = {}
    for product, (path, variable) in MODELS.items():
        query = urlencode(
            {
                "service": "WCS",
                "version": "2.0.1",
                "request": "GetCapabilities",
                "language": "eng",
            }
        )
        record, content = fetch(
            ORIGIN + path + "GetCapabilities?" + query, variable, METADATA_LIMIT
        )
        record.update(product=product, operation="GetCapabilities")
        if content and record["status"] == 200:
            try:
                ids = capabilities(content)
                model_ids[product] = ids
                record.update(
                    coverage_count=len(ids),
                    first_variables=list(dict.fromkeys(i.split("___")[0] for i in ids))[
                        :20
                    ],
                    first_coverage_ids=ids[:5],
                )
                (root / f"{product}-capabilities.xml").write_bytes(content)
            except (ET.ParseError, ValueError):
                record["outcome"] = "invalid_wcs_capabilities"
        results.append(record)
    # Both products must be authorized before ANY field request (including description).
    if len(model_ids) == len(MODELS):
        for product, (path, variable) in MODELS.items():
            candidates = sorted(
                i
                for i in model_ids[product]
                if i.split("___")[0]
                == "TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND"
            )
            if not candidates:
                results.append(
                    {
                        "product": product,
                        "operation": "GetCoverage",
                        "status": "skipped_no_advertised_temperature",
                    }
                )
                continue
            coverage = candidates[-1]
            base = [("service", "WCS"), ("version", "2.0.1")]
            query = urlencode(base + [("coverageID", coverage)])
            record, content = fetch(
                ORIGIN + path + "DescribeCoverage?" + query, variable, METADATA_LIMIT
            )
            record.update(
                product=product, operation="DescribeCoverage", coverage_id=coverage
            )
            results.append(record)
            if not content or record["status"] != 200:
                continue
            (root / f"{product}-description.xml").write_bytes(content)
            try:
                subsets, selected = field_parameters(content)
            except (ET.ParseError, ValueError, StopIteration):
                record["outcome"] = "unsupported_description_no_field_requested"
                continue
            query = urlencode(
                base + [("coverageid", coverage), ("format", "image/tiff")] + subsets
            )
            field, content = fetch(
                ORIGIN + path + "GetCoverage?" + query, variable, FIELD_LIMIT
            )
            field.update(
                product=product,
                operation="GetCoverage",
                coverage_id=coverage,
                selected_axes=selected,
                nature="model_field_not_station_observation",
            )
            if content and field["status"] == 200:
                try:
                    width, height = tiff_dimensions(content)
                    field.update(
                        outcome="validated_tiny_tiff",
                        width=width,
                        height=height,
                        sha256=hashlib.sha256(content).hexdigest(),
                    )
                    (root / f"{product}-tiny.tiff").write_bytes(content)
                except (ValueError, KeyError, struct.error):
                    field["outcome"] = "invalid_or_oversized_tiff"
            results.append(field)
    else:
        results.append(
            {
                "operation": "GetCoverage",
                "status": "skipped_requires_both_model_capabilities",
            }
        )
    for product, path, variable in (
        (
            "observations-v1",
            "DPObs/v1/liste-stations",
            "METEOFRANCE_OBSERVATIONS_API_KEY",
        ),
        (
            "observations-v2",
            "DPObs/v2/liste-stations",
            "METEOFRANCE_OBSERVATIONS_API_KEY",
        ),
        (
            "package-observations-v2",
            "DPPaquetObs/v2/liste-stations",
            "METEOFRANCE_OBSERVATIONS_API_KEY",
        ),
        (
            "climatology",
            "DPClim/v1/liste-stations/quotidienne?id-departement=29",
            "METEOFRANCE_CLIMATOLOGY_API_KEY",
        ),
    ):
        record, _ = fetch(ORIGIN + path, variable, CATALOGUE_LIMIT)
        record.update(product=product, operation="catalogue")
        results.append(record)
    (root / "access.json").write_text(json.dumps(results, indent=2) + "\n")
    return results


def main() -> None:
    results = probe(Path("work/operational-access"))
    print(
        json.dumps({"observed_at": datetime.now(UTC).isoformat(), "results": results})
    )


if __name__ == "__main__":
    main()
