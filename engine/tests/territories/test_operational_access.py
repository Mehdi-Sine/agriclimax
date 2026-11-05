"""Probe authorization isolation and hard bounds; all HTTP here is synthetic."""

import gzip
import importlib.util
import struct
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest

SPEC = importlib.util.spec_from_file_location(
    "probe_operational_access",
    Path(__file__).resolve().parents[3] / "scripts/probe_operational_access.py",
)
assert SPEC and SPEC.loader
probe = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = probe
SPEC.loader.exec_module(probe)

COVERAGE = "TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND___2026-11-05T00.00.00Z"
CAPS = f'<w:Capabilities xmlns:w="wcs"><w:CoverageId>{COVERAGE}</w:CoverageId></w:Capabilities>'.encode()
DESCRIPTION = b"""<w:CoverageDescriptions xmlns:w="wcs" xmlns:g="gml">
<g:Envelope axisLabels="time lat long height">
<g:lowerCorner>2026-11-05T00:00:00Z 40 -10 2</g:lowerCorner>
<g:upperCorner>2026-11-07T00:00:00Z 55 15 100</g:upperCorner>
</g:Envelope></w:CoverageDescriptions>"""


def tiny_tiff(width=5, height=5):
    return (
        b"II*\0"
        + struct.pack("<IH", 8, 2)
        + b"".join(
            struct.pack("<HHII", tag, 4, 1, value) for tag, value in [(256, width), (257, height)]
        )
    )


def test_model_product_keys_and_gated_small_subsets(monkeypatch, tmp_path):
    calls = []

    def fetch(url, variable, limit):
        calls.append((url, variable, limit))
        body = (
            CAPS
            if "GetCapabilities" in url
            else DESCRIPTION
            if "DescribeCoverage" in url
            else tiny_tiff()
        )
        return {"status": 200}, body

    monkeypatch.setattr(probe, "fetch", fetch)
    results = probe.probe(tmp_path)
    models = [(url, key, limit) for url, key, limit in calls if "/wcs/" in url]
    assert len(models) == 6
    for url, key, limit in models:
        assert key == (
            "METEOFRANCE_AROME_API_KEY" if "/arome/" in url else "METEOFRANCE_ARPEGE_API_KEY"
        )
        if "GetCoverage?" in url:
            assert limit == 262144
            query = parse_qs(urlsplit(url).query)
            assert query["subset"] == [
                'time("2026-11-05T00:00:00Z")',
                "lat(48,48.1)",
                "long(1.4,1.5)",
                "height(2)",
            ]
    assert sum(r.get("outcome") == "validated_tiny_tiff" for r in results) == 2


@pytest.mark.parametrize("denied", ["arome", "arpege"])
def test_no_field_when_either_model_denied(monkeypatch, tmp_path, denied):
    calls = []

    def fetch(url, variable, limit):
        calls.append(url)
        return ({"status": 401}, b"") if f"/{denied}/" in url else ({"status": 200}, CAPS)

    monkeypatch.setattr(probe, "fetch", fetch)
    probe.probe(tmp_path)
    assert not any("GetCoverage?" in u or "DescribeCoverage?" in u for u in calls)


def test_no_model_fallback_to_observations(monkeypatch):
    monkeypatch.delenv("METEOFRANCE_AROME_API_KEY", raising=False)
    monkeypatch.setenv("METEOFRANCE_OBSERVATIONS_API_KEY", "synthetic-observations")
    monkeypatch.setattr(
        probe, "build_opener", lambda *_: pytest.fail("No HTTP without product key")
    )
    record, body = probe.fetch(probe.ORIGIN, "METEOFRANCE_AROME_API_KEY", 100)
    assert record["status"] == "binding_absent" and not body


@pytest.mark.parametrize("body", [b"<ExceptionReport/>", b"<!DOCTYPE x><Capabilities/>"])
def test_http_200_is_not_authorization_proof_without_capabilities(body):
    with pytest.raises(ValueError):
        probe.capabilities(body)


def test_extra_axis_is_refused():
    description = DESCRIPTION.replace(b'height"', b'pressure"')
    with pytest.raises(ValueError, match="Unsupported axis"):
        probe.field_parameters(description)


def test_national_sized_tiff_refused():
    with pytest.raises(ValueError, match="budget"):
        probe.tiff_dimensions(tiny_tiff(1000, 1000))


def test_response_budget_and_credential_echo_not_retained(monkeypatch):
    monkeypatch.setenv("METEOFRANCE_AROME_API_KEY", "synthetic-secret-canary")

    class Response:
        status = 200

        def __init__(self):
            self.headers = {"Content-Encoding": self.encoding}

        body = b"synthetic-secret-canary"
        encoding = "identity"

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return None

        def read(self, size):
            return self.body[:size]

    class Opener:
        def open(self, request, timeout):
            assert request.get_header("Apikey") == "synthetic-secret-canary"
            return Response()

    monkeypatch.setattr(probe, "build_opener", lambda *_: Opener())
    record, body = probe.fetch(probe.ORIGIN, "METEOFRANCE_AROME_API_KEY", 100)
    assert not body and record["outcome"] == "credential_echo_rejected"
    assert "synthetic-secret-canary" not in str(record)
    Response.body = b"x" * 101
    record, body = probe.fetch(probe.ORIGIN, "METEOFRANCE_AROME_API_KEY", 100)
    assert not body and record["status"] == 200 and record["outcome"] == "response_budget_exceeded"

    # A small compressed response must not bypass the decompressed-byte bound.
    Response.encoding = "gzip"
    Response.body = gzip.compress(b"x" * 101)
    record, body = probe.fetch(probe.ORIGIN, "METEOFRANCE_AROME_API_KEY", 100)
    assert not body and record["outcome"] == "response_budget_exceeded"
    Response.body = gzip.compress(b"synthetic-secret-canary")
    record, body = probe.fetch(probe.ORIGIN, "METEOFRANCE_AROME_API_KEY", 100)
    assert not body and record["outcome"] == "credential_echo_rejected"


@pytest.mark.parametrize("product", ["arome", "arpege"])
def test_official_gml_envelope_with_separate_time_period(product):
    root = Path(__file__).resolve().parents[3]
    content = (
        root / "engine/tests/territories/fixtures" / f"{product}-wcs-description.xml"
    ).read_bytes()
    subsets, selected = probe.field_parameters(content)
    assert subsets == [
        ("subset", "long(1.4,1.5)"),
        ("subset", "lat(48,48.1)"),
        ("subset", "height(2)"),
        ("subset", 'time("2026-11-05T18:00:00Z")'),
    ]
    assert selected["height"] == 2
