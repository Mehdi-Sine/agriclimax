"""Bounded read-only access probe; product credentials never enter reports or URLs."""

import gzip
import hashlib
import io
import json
import os
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
            # Only a bounded, structured service exception is reported; never raw error text.
            error_body = error.read(4097)
            if len(error_body) <= 4096 and key.encode() not in error_body:
                try:
                    if error.headers.get("Content-Encoding") == "gzip":
                        with gzip.GzipFile(fileobj=io.BytesIO(error_body)) as zipped:
                            error_body = zipped.read(4097)
                    if len(error_body) <= 4096 and key.encode() not in error_body:
                        parsed = xml_root(error_body)
                        codes = [
                            e.attrib["exceptionCode"]
                            for e in parsed.iter()
                            if "exceptionCode" in e.attrib
                        ]
                        if codes:
                            record["service_exception_codes"] = codes[:3]
                        messages = [
                            " ".join((e.text or "").split())[:240]
                            for e in parsed.iter()
                            if e.tag.endswith("}ExceptionText")
                        ]
                        if messages:
                            record["service_exception_messages"] = messages[:3]
                except (ET.ParseError, ValueError, OSError, EOFError):
                    pass
            error.close()
        except (URLError, OSError, TimeoutError, ValueError, EOFError):
            record["outcome"] = "network_or_response_error"
            if record["status"] == "binding_absent":
                record["status"] = "network_unavailable"
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


def field_parameters(
    content: bytes,
    bounds: tuple[float, float, float, float] = (1.4, 48.0, 1.5, 48.1),
    valid_at: datetime | None = None,
) -> tuple[list[tuple[str, str]], dict[str, object]]:
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
    if envelope.tag.endswith("}EnvelopeWithTimePeriod") and len(lows) == len(axes) - 1:
        # GML keeps time in begin/endPosition, outside the three spatial corners.
        spatial_axes = [axis for axis in axes if axis.lower() != "time"]
        if len(spatial_axes) != len(lows) or len(highs) != len(lows):
            raise ValueError("Ambiguous spatial axes")
        lower_by_axis = dict(zip(spatial_axes, lows, strict=True))
        upper_by_axis = dict(zip(spatial_axes, highs, strict=True))
        time_axis = next(axis for axis in axes if axis.lower() == "time")
        begin = next(e.text for e in envelope if e.tag.endswith("}beginPosition"))
        end = next(e.text for e in envelope if e.tag.endswith("}endPosition"))
        if not begin or not end:
            raise ValueError("Missing time period")
        lower_by_axis[time_axis], upper_by_axis[time_axis] = begin, end
        lows = [lower_by_axis[axis] for axis in axes]
        highs = [upper_by_axis[axis] for axis in axes]
    if len(lows) != len(axes) or len(highs) != len(axes) or len(set(axes)) != len(axes):
        raise ValueError("Ambiguous axes")
    subsets = []
    selected: dict[str, object] = {}
    found = set()
    for axis, low, high in zip(axes, lows, highs, strict=True):
        kind = axis.lower()
        if kind in {"lat", "latitude"}:
            a, b = bounds[1], bounds[3]
            found.add("latitude")
        elif kind in {"long", "lon", "longitude"}:
            a, b = bounds[0], bounds[2]
            found.add("longitude")
        elif kind == "time":
            when = valid_at or datetime.fromisoformat(low)
            if (
                when.utcoffset() != datetime.fromisoformat(low).utcoffset()
                or when.utcoffset() is None
            ):
                raise ValueError("Time without matching timezone")
            if not datetime.fromisoformat(low) <= when <= datetime.fromisoformat(high):
                raise ValueError("Time outside advertised coverage")
            instant = when.isoformat().replace("+00:00", "Z")
            subsets.append(("subset", f"{axis}({instant})"))
            selected[axis] = instant
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


def grib_points(content: bytes) -> int:
    """Require one complete GRIB2 field and at most 100 native grid points."""
    if content[:4] != b"GRIB" or len(content) < 20 or content[7] != 2:
        raise ValueError("Not GRIB2")
    if int.from_bytes(content[8:16], "big") != len(content) or content[-4:] != b"7777":
        raise ValueError("Not one complete GRIB message")
    offset, points = 16, 0
    while offset < len(content) - 4:
        length = int.from_bytes(content[offset : offset + 4], "big")
        if length < 5 or offset + length > len(content) - 4:
            raise ValueError("Invalid section")
        if content[offset + 4] == 3:
            if length < 14 or points:
                raise ValueError("Invalid grid section")
            points = int.from_bytes(content[offset + 6 : offset + 10], "big")
        offset += length
    if offset != len(content) - 4 or not 0 < points <= 100:
        raise ValueError("Field grid exceeds pilot budget")
    return points


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
                    pilot_variables=[
                        v
                        for v in (
                            "TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND",
                            "DEW_POINT_TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND",
                            "RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND",
                            "TOTAL_PRECIPITATION__GROUND_OR_WATER_SURFACE",
                            "WIND_SPEED__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND",
                        )
                        if any(i.split("___")[0] == v for i in ids)
                    ],
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
                base
                + [("coverageid", coverage), ("format", "application/wmo-grib")]
                + subsets
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
                    points = grib_points(content)
                    field.update(
                        outcome="validated_tiny_grib",
                        grid_points=points,
                        sha256=hashlib.sha256(content).hexdigest(),
                    )
                    (root / f"{product}-tiny.grib2").write_bytes(content)
                except ValueError:
                    field["outcome"] = "invalid_or_oversized_grib"
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
