"""Metadata access is separate from scientific acquisition; no live requests."""

import json
from io import BytesIO
from urllib.error import HTTPError
from unittest.mock import Mock

import pytest

import meteofrance_acquisition_health as health
import probe_operational_access as transport


@pytest.mark.parametrize("status,reason", [
    (401, "authentication_invalid_or_expired"), (403, "subscription_or_product_denied"),
    (404, "resource_or_endpoint_unavailable"), (429, "rate_limited"),
    (503, "service_unavailable"),
])
def test_model_http_reasons_and_no_raw_service_text(monkeypatch, status, reason):
    key = "synthetic-private-key"
    monkeypatch.setenv("METEOFRANCE_AROME_API_KEY", key)
    body = b'<x:ExceptionReport xmlns:x="ows"><x:Exception exceptionCode="PRIVATE"><x:ExceptionText>private service details</x:ExceptionText></x:Exception></x:ExceptionReport>'
    opener = Mock(side_effect=HTTPError("https://synthetic.invalid", status, key, {}, BytesIO(body)))
    monkeypatch.setattr(transport, "build_opener", lambda *_: Mock(open=opener))
    record, content = transport.fetch(transport.ORIGIN, "METEOFRANCE_AROME_API_KEY", 4096)
    assert record["outcome"] == reason and not content
    assert opener.call_count == 1
    assert all(s not in json.dumps(record) for s in (key, "private service details", "PRIVATE"))


@pytest.mark.parametrize("body", [b"<html>login</html>", b"<invalid", b"<ExceptionReport/>"])
def test_model_http_200_does_not_prove_compatible_access(monkeypatch, body):
    monkeypatch.setattr(health, "fetch", lambda *_: ({"status": 200, "outcome": "received"}, body))
    result = health.model_probe("arome")
    assert result["status"] == "format_incompatible"
    assert result["http_status"] == 200
    assert result["scientific_data_qualified"] is False
    assert result["pra_coverage_verified"] is False


def test_product_binding_never_substitutes_observations(monkeypatch):
    monkeypatch.delenv("METEOFRANCE_AROME_API_KEY", raising=False)
    monkeypatch.setenv("METEOFRANCE_OBSERVATIONS_API_KEY", "synthetic-other-product")
    monkeypatch.setattr(transport, "build_opener", lambda *_: pytest.fail("No HTTP without binding"))
    result = health.model_probe("arome")
    assert result["status"] == "binding_absent"
    assert result["http_status"] is None


def test_metadata_success_has_no_data_or_coverage_claim(monkeypatch):
    body = b'<w:Capabilities xmlns:w="wcs"><w:CoverageId>sample</w:CoverageId></w:Capabilities>'
    monkeypatch.setattr(health, "fetch", lambda *_: ({"status": 200, "outcome": "received"}, body))
    result = health.model_probe("arpege")
    assert result["status"] == "access_succeeded"
    assert result["advertised_coverages"] == 1
    assert result["scientific_data_qualified"] is False
