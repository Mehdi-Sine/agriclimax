"""Metadata access is separate from scientific acquisition; no live requests."""

import json
import sys
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from unittest.mock import Mock
from urllib.error import HTTPError

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))

import meteofrance_acquisition_health as health
import probe_operational_access as transport
from meteofrance_acquisition_sample import verify_field
from national_weather_sources import Budget, WcsAcquisitionError, WcsProvider


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


@pytest.mark.parametrize("change", [
    {"dataDate": 20261108}, {"validityTime": 600}, {"endStep": 6},
    {"units": "degC"}, {"level": 10}, {"shortName": "2r"},
    {"iDirectionIncrementInDegrees": 0.1},
])
def test_native_sample_refuses_wrong_run_validity_variable_or_grid(change):
    meta = {"dataDate": 20261111, "dataTime": 0, "validityDate": 20261111,
            "validityTime": 0, "units": "K", "level": 2, "shortName": "2t",
            "typeOfLevel": "heightAboveGround", "typeOfGeneratingProcess": 2,
            "stepUnits": 1, "endStep": 0, "iDirectionIncrementInDegrees": 0.025,
            "jDirectionIncrementInDegrees": 0.025}
    run = datetime(2026, 11, 11, tzinfo=UTC)
    verify_field(meta, run, run, "arome")
    with pytest.raises(ValueError, match="mismatch"):
        verify_field({**meta, **change}, run, run, "arome")


def test_field_denial_keeps_http_operation_and_stops_without_retry(monkeypatch, tmp_path):
    import national_weather_sources as sources

    request = Mock(return_value=({"status": 403, "outcome": "subscription_or_product_denied",
                                 "wire_bytes_read": 0}, b""))
    monkeypatch.setattr(sources, "fetch", request)
    provider = WcsProvider("arome", tmp_path, Budget())
    with pytest.raises(WcsAcquisitionError) as caught:
        provider.request("GetCoverage", [], 256)
    assert caught.value.http_status == 403
    assert caught.value.operation == "GetCoverage"
    assert caught.value.reason == "subscription_or_product_denied"
    assert request.call_count == 1
