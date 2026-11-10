"""Synthetic credentials only. Exercise API Key, OAuth and real loopback HTTP."""

import importlib.util
import json
import threading
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from unittest.mock import Mock
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener

import pytest

from agriclimax.ingestion.meteofrance import (
    MeteoFranceAccessError,
    MeteoFranceClient,
    MeteoFranceTransportError,
    NoRedirect,
)
from agriclimax.ingestion.station_auth import TOKEN_URL, StationAuth

KEY = "synthetic-key-only"
APP = "synthetic-application-only"
TOKEN = "synthetic-bearer-only"


@pytest.fixture(autouse=True)
def isolated_credentials(monkeypatch):
    for product in ("CLIMATOLOGY", "OBSERVATIONS"):
        monkeypatch.delenv(f"METEOFRANCE_{product}_APPLICATION_ID", raising=False)
        monkeypatch.setenv(f"METEOFRANCE_{product}_API_KEY", KEY)


def response(body, status=200):
    r = BytesIO(json.dumps(body).encode() if not isinstance(body, bytes) else body)
    r.status = status
    return r


def token_response(token=TOKEN, ttl=3600):
    return response({"access_token": token, "token_type": "Bearer", "expires_in": ttl})


def http_error(status, body=None):
    return HTTPError("https://synthetic.invalid", status, "never report " + KEY, {},
                     BytesIO(json.dumps(body or {}).encode()))


def test_api_key_is_not_a_subscription_id_or_oauth_token():
    opener = Mock(return_value=response(b"[]"))
    client = MeteoFranceClient("climatology", opener=opener, sleep=lambda _: None)
    client.get("liste-stations/quotidienne")
    request = opener.call_args.args[0]
    assert request.get_header("Apikey") == KEY
    assert request.get_header("Authorization") is None
    assert KEY not in request.full_url
    assert opener.call_count == 1


def test_oauth_cache_proactive_renewal_and_explicit_priority(monkeypatch):
    monkeypatch.setenv("METEOFRANCE_CLIMATOLOGY_APPLICATION_ID", APP)
    opener = Mock(side_effect=[token_response(), token_response("synthetic-renewed")])
    clock = [0.0]
    auth = StationAuth("climatology", opener, clock=lambda: clock[0])
    assert auth.headers() == {"Authorization": "Bearer " + TOKEN}
    clock[0] = 3550
    assert auth.headers() == {"Authorization": "Bearer " + TOKEN}
    assert opener.call_count == 1
    clock[0] = 3570
    assert auth.headers() == {"Authorization": "Bearer synthetic-renewed"}
    request = opener.call_args.args[0]
    assert request.full_url == TOKEN_URL
    assert request.method == "POST" and request.data == b"grant_type=client_credentials"
    assert request.get_header("Authorization") == "Basic " + APP
    assert request.get_header("Apikey") is None


def test_oauth_401_refreshes_once_and_replays_same_request(monkeypatch):
    monkeypatch.setenv("METEOFRANCE_OBSERVATIONS_APPLICATION_ID", APP)
    opener = Mock(side_effect=[token_response(), http_error(401), token_response("synthetic-renewed"), response(b"csv")])
    client = MeteoFranceClient("observations", opener=opener, sleep=lambda _: None)
    assert client.get("liste-stations") == (200, b"csv")
    requests = [c.args[0] for c in opener.call_args_list]
    assert [r.get_method() for r in requests] == ["POST", "GET", "POST", "GET"]
    assert requests[1].full_url == requests[3].full_url
    assert requests[3].get_header("Authorization") == "Bearer synthetic-renewed"
    assert all(secret not in r.full_url for secret in (APP, TOKEN, KEY) for r in requests)


@pytest.mark.parametrize("oauth,status,count", [(False, 401, 1), (False, 403, 1), (True, 403, 2), (True, 401, 4)])
def test_no_auth_retry_storm_or_credential_fallback(monkeypatch, oauth, status, count):
    if oauth:
        monkeypatch.setenv("METEOFRANCE_CLIMATOLOGY_APPLICATION_ID", APP)
    sequence = [token_response(), http_error(status), token_response(), http_error(status)] if oauth else [http_error(status)]
    opener = Mock(side_effect=sequence)
    client = MeteoFranceClient("climatology", opener=opener, sleep=lambda _: None)
    with pytest.raises(MeteoFranceAccessError) as caught:
        client.get("liste-stations/quotidienne")
    assert opener.call_count == count
    assert all(secret not in str(caught.value) for secret in (KEY, APP, TOKEN))
    assert all(c.args[0].get_header("Apikey") is None for c in opener.call_args_list) if oauth else True


@pytest.mark.parametrize("body", [{}, {"access_token": TOKEN, "token_type": "Bearer", "expires_in": 0},
                                 {"access_token": TOKEN, "token_type": "Bearer", "expires_in": True},
                                 {"access_token": TOKEN, "token_type": "Basic", "expires_in": 3600}])
def test_bad_token_responses_fail_closed(monkeypatch, body):
    monkeypatch.setenv("METEOFRANCE_CLIMATOLOGY_APPLICATION_ID", APP)
    auth = StationAuth("climatology", Mock(return_value=response(body)))
    with pytest.raises(MeteoFranceAccessError, match="response incompatible"):
        auth.headers()


def health_module():
    spec = importlib.util.spec_from_file_location("station_health", Path("scripts/meteofrance_station_health.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize("status,body,expected", [
    (401, {"code": "900903", "description": "Access token expired " + KEY}, "token_expired"),
    (401, {"code": "900901", "description": KEY}, "authentication_invalid_or_expired"),
    (403, {}, "subscription_not_authorized"),
    (404, {}, "endpoint_incompatible"), (410, {}, "endpoint_incompatible"),
])
def test_health_preserves_evidence_limits_and_never_prints_service_text(monkeypatch, status, body, expected):
    module = health_module()
    client = MeteoFranceClient("observations", opener=Mock(side_effect=http_error(status, body)), sleep=lambda _: None)
    monkeypatch.setattr(module, "MeteoFranceClient", lambda _: client)
    result = module.probe("observations")
    assert result["status"] == expected
    assert all(secret not in json.dumps(result) for secret in (KEY, APP, TOKEN))


def test_health_missing_key_and_separate_products(monkeypatch):
    monkeypatch.delenv("METEOFRANCE_CLIMATOLOGY_API_KEY")
    module = health_module()
    assert module.probe("climatology")["status"] == "credential_missing"
    client = MeteoFranceClient("observations", opener=Mock(return_value=response(
        b"Id_station;Nom_usuel;Latitude;Longitude;Altitude\n29075001;synthetic;48;-4;92\n")), sleep=lambda _: None)
    monkeypatch.setattr(module, "MeteoFranceClient", lambda _: client)
    assert module.probe("observations")["status"] == "access_succeeded"


@pytest.mark.parametrize("body", [b"<html>login</html>", b"id;wrong\n1;2\n"])
def test_health_rejects_http_200_with_wrong_catalogue(monkeypatch, body):
    module = health_module()
    client = MeteoFranceClient("observations", opener=Mock(return_value=response(body)), sleep=lambda _: None)
    monkeypatch.setattr(module, "MeteoFranceClient", lambda _: client)
    assert module.probe("observations")["status"] == "endpoint_incompatible"


@contextmanager
def loopback_service(*, redirect=False):
    calls = []
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_POST(self):
            calls.append((self.path, self.headers.get("Authorization"), self.rfile.read(int(self.headers["Content-Length"]))))
            self.send_response(302 if redirect else 200)
            if redirect:
                self.send_header("Location", f"http://127.0.0.1:{self.server.server_port}/untrusted")
            self.end_headers()
            self.wfile.write(json.dumps({"access_token": TOKEN, "token_type": "Bearer", "expires_in": 3600}).encode())

        def do_GET(self):
            calls.append((self.path, self.headers.get("Authorization"), None))
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"[]")
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server.server_port, calls
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def test_integration_actual_http_token_exchange_and_catalogue(monkeypatch):
    monkeypatch.setenv("METEOFRANCE_OBSERVATIONS_APPLICATION_ID", APP)
    with loopback_service() as (port, calls):
        transport = build_opener(NoRedirect())
        def opener(request, **kwargs):
            assert request.full_url.startswith((TOKEN_URL, "https://public-api.meteofrance.fr/public/DPObs/v1/"))
            # Test-only loopback transport. Production origins are fixed HTTPS.
            url = f"http://127.0.0.1:{port}" + urlsplit(request.full_url).path
            return transport.open(Request(url, data=request.data, method=request.get_method(), headers=dict(request.header_items())), **kwargs)
        client = MeteoFranceClient("observations", opener=opener, sleep=lambda _: None)
        assert client.get("liste-stations") == (200, b"[]")
        assert client.get("liste-stations") == (200, b"[]")
    assert [path for path, _, _ in calls] == ["/token", "/public/DPObs/v1/liste-stations", "/public/DPObs/v1/liste-stations"]
    assert calls[0][1:] == ("Basic " + APP, b"grant_type=client_credentials")
    assert calls[1][1] == "Bearer " + TOKEN


def test_integration_token_redirect_never_forwards_credentials(monkeypatch):
    monkeypatch.setenv("METEOFRANCE_OBSERVATIONS_APPLICATION_ID", APP)
    with loopback_service(redirect=True) as (port, calls):
        transport = build_opener(NoRedirect())
        def opener(request, **kwargs):
            assert request.full_url == TOKEN_URL
            return transport.open(Request(f"http://127.0.0.1:{port}/token", data=request.data,
                method=request.get_method(), headers=dict(request.header_items())), **kwargs)
        client = MeteoFranceClient("observations", opener=opener, sleep=lambda _: None)
        with pytest.raises(MeteoFranceAccessError):
            client.get("liste-stations")
    assert len(calls) == 1 and calls[0][0] == "/token"


@pytest.mark.parametrize("status", [429, 503])
def test_token_service_temporary_failure_is_not_a_permanent_auth_error(monkeypatch, status):
    monkeypatch.setenv("METEOFRANCE_CLIMATOLOGY_APPLICATION_ID", APP)
    opener = Mock(side_effect=http_error(status))
    client = MeteoFranceClient("climatology", opener=opener, sleep=lambda _: None)
    with pytest.raises(MeteoFranceTransportError) as caught:
        client.get("liste-stations/quotidienne")
    assert caught.value.http_status == status
    assert opener.call_count == 1
