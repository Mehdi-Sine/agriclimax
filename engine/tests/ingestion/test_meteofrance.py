"""Offline source-shaped examples are synthetic, never scientific evidence."""

import hashlib
import json
from datetime import UTC, date, datetime, timedelta
from io import BytesIO
from unittest.mock import Mock
from urllib.error import HTTPError

import pytest

from agriclimax.ingestion.meteofrance import (
    MeteoFranceAccessError,
    MeteoFranceClient,
    MeteoFranceProvider,
    csv_rows,
)
from agriclimax.ingestion.models import Provenance
from agriclimax.ingestion.normalize import normalize
from agriclimax.ingestion.pipeline import run
from agriclimax.ingestion.storage import SQLiteObservationRepository

DAY = date(2026, 9, 1)
NOW = datetime(2026, 10, 14, 12, tzinfo=UTC)
STATION = "29075001"
CSV = (
    b"POSTE;DATE;TN;QTN;TX;QTX;TM;QTM;UM;QUM;RR;QRR;ETPMON;QETPMON\n"
    b"29075001;20260901;10,2;1;20,3;1;14,8;1;70;1;0,0;1;2,4;9\n"
)
CATALOG = json.dumps(
    [
        {
            "id": STATION,
            "nom": "SYNTHETIC",
            "lat": 48.45,
            "lon": -4.39,
            "alt": 92,
            "posteOuvert": True,
        }
    ]
).encode()


def provider(content=CSV, *, product="climatology", sample=None):
    calls = []

    def get(path, params=None):
        calls.append((path, params))
        if path == "liste-stations/quotidienne":
            return 200, CATALOG
        if path == "commande-station/quotidienne":
            return 202, b'{"elaboreProduitAvecDemandeResponse":{"return":"123"}}'
        if path == "commande/fichier":
            return 201, content
        if path == "liste-stations":
            return 200, (
                b"Id_station;Nom_usuel;Latitude;Longitude;Altitude;Pack\n"
                b"29075001;SYNTHETIC;48.45;-4.39;92;RADOME\n"
            )
        return 200, json.dumps(sample).encode()

    client = Mock(spec=MeteoFranceClient)
    client.get.side_effect = get
    day = DAY if product == "climatology" else NOW.date()
    instance = MeteoFranceProvider(
        (STATION,),
        day,
        day,
        product=product,
        client=client,
        clock=lambda: NOW,
        sleep=lambda _: None,
    )
    return instance, calls


def batch(instance, day=DAY):
    source = instance.download(day)
    payload = instance.decode(source.content)
    provenance = Provenance(
        source_id=instance.source_id,
        retrieved_at=NOW,
        published_at=None,
        checksum=hashlib.sha256(source.content).hexdigest(),
        demo=False,
        publication_time_known=False,
    )
    return normalize(payload, day, provenance, timedelta(days=2), NOW)


def test_real_format_mapping_without_imputation():
    instance, calls = provider()
    result = batch(instance)
    assert result.status == "complete"
    assert result.freshness == "stale"  # Downloading a historical file cannot make it fresh.
    assert [r.value for r in result.observations] == [10.2, 20.3, 14.8, 70, 0, 2.4]
    assert result.observations[2].value != (10.2 + 20.3) / 2
    assert result.observations[-1].variable == "etp_monteith"
    assert "et0_equivalence_not_asserted" in result.observations[-1].quality_flags
    assert all(r.temporal_resolution == "daily" for r in result.observations)
    assert not result.provenance.publication_time_known
    assert result.provenance.published_at is None
    assert result.observations[0].source_checksum == hashlib.sha256(CSV).hexdigest()
    batch(instance)
    assert len([path for path, _ in calls if path == "commande-station/quotidienne"]) == 1


def test_nulls_missing_day_and_zero_rain_are_distinct():
    instance, _ = provider(CSV.replace(b";70;1;", b";;1;").replace(b";2,4;9", b";;9"))
    result = batch(instance)
    assert result.status == "partial"
    assert result.observations[3].value is None
    assert "missing" in result.observations[3].quality_flags
    assert result.observations[4].value == 0
    instance, _ = provider(CSV.splitlines()[0] + b"\n")
    assert batch(instance).status == "missing"
    assert all(r.value is None for r in batch(instance).observations)
    assert "source_day_absent" in batch(instance).observations[0].quality_flags


@pytest.mark.parametrize(
    "content",
    [
        CSV.replace(b"29075001;20260901", b"12345678;20260901"),
        CSV + CSV.splitlines()[1] + b"\n",
        CSV.replace(b"20260901", b"20260902"),
        b"POSTE;DATE;TN\n29075001;20260901;10\n",
        b"A;A\n1;2\n",
    ],
)
def test_wrong_station_dates_duplicates_or_format_rejected(content):
    instance, _ = provider(content)
    with pytest.raises(ValueError):
        instance.download(DAY)


def test_invalid_physical_values_quarantined(tmp_path):
    instance, _ = provider(CSV.replace(b";70;1;", b";170;1;"))
    repository = SQLiteObservationRepository(tmp_path / "db.sqlite")
    manifest = run(instance, repository, tmp_path, DAY, DAY, clock=lambda: NOW, log=lambda _: None)
    assert not manifest["successful"]
    assert repository.read_all() == []


def test_live_replay_and_dry_run(tmp_path):
    instance, _ = provider()
    repository = SQLiteObservationRepository(tmp_path / "db.sqlite")
    first = run(instance, repository, tmp_path, DAY, DAY, clock=lambda: NOW, log=lambda _: None)
    second = run(instance, repository, tmp_path, DAY, DAY, clock=lambda: NOW, log=lambda _: None)
    assert first["days"][0]["changed"] and not second["days"][0]["changed"]
    dry = tmp_path / "dry"
    assert run(instance, None, dry, DAY, DAY, dry_run=True, clock=lambda: NOW, log=lambda _: None)[
        "successful"
    ]
    assert not dry.exists()


def test_recent_hourly_conversion_is_not_a_daily_aggregate():
    instance, _ = provider(
        product="observations",
        sample=[
            {
                "geo_id_insee": STATION,
                "validity_time": "2026-10-14T11:00:00Z",
                "t": 283.15,
                "u": 60,
                "rr1": 0,
            }
        ],
    )
    result = batch(instance, NOW.date())
    assert result.status == "complete"
    assert result.observations[0].value == 10
    assert result.observations[0].observed_at.hour == 11
    assert all("recent_sample_not_daily_aggregate" in r.quality_flags for r in result.observations)
    assert all(r.temporal_resolution == "hourly" for r in result.observations)
    assert not any(
        r.variable in {"temperature_min", "temperature_max", "etp_monteith"}
        for r in result.observations
    )


def test_http_auth_failures_are_fatal_and_never_leak_key(monkeypatch, tmp_path):
    monkeypatch.setenv("METEOFRANCE_CLIMATOLOGY_API_KEY", "synthetic-private-value")
    error = HTTPError("https://test.invalid", 403, "contains synthetic-private-value", {}, None)
    opener = Mock(side_effect=error)
    client = MeteoFranceClient("climatology", opener=opener, sleep=lambda _: None)
    with pytest.raises(MeteoFranceAccessError) as caught:
        client.get("liste-stations/quotidienne")
    assert "METEOFRANCE_CLIMATOLOGY_API_KEY" in str(caught.value)
    assert "synthetic-private-value" not in str(caught.value)
    assert opener.call_count == 1
    instance, _ = provider()
    instance.client.get.side_effect = caught.value
    with pytest.raises(MeteoFranceAccessError):
        run(instance, None, tmp_path, DAY, DAY, dry_run=True, clock=lambda: NOW)


def test_bounded_retries_and_polling(monkeypatch):
    monkeypatch.setenv("METEOFRANCE_OBSERVATIONS_API_KEY", "synthetic-private-value")
    response = BytesIO(b"[]")
    response.status = 200
    opener = Mock(
        side_effect=[
            HTTPError("https://test.invalid", 429, "limit", {"Retry-After": "1"}, None),
            response,
        ]
    )
    sleep = Mock()
    client = MeteoFranceClient("observations", opener=opener, sleep=sleep)
    assert client.get("liste-stations") == (200, b"[]")
    assert opener.call_count == 2
    assert opener.call_args[0][0].get_header("Apikey") == "synthetic-private-value"
    assert "synthetic-private-value" not in opener.call_args[0][0].full_url
    instance, _ = provider()
    instance.prepare()
    instance.client.get.side_effect = [
        (202, b'{"elaboreProduitAvecDemandeResponse":{"return":"123"}}'),
        (204, b""),
        (201, CSV),
    ]
    assert instance.archive(STATION)[0][0]["TM"] == "14,8"


def test_bad_configuration_missing_key_and_csv_shape(monkeypatch):
    monkeypatch.delenv("METEOFRANCE_CLIMATOLOGY_API_KEY", raising=False)
    with pytest.raises(MeteoFranceAccessError, match="METEOFRANCE_CLIMATOLOGY_API_KEY"):
        MeteoFranceClient("climatology")
    for ids in [(STATION, STATION), ("bad",), ()]:
        with pytest.raises(ValueError):
            MeteoFranceProvider(ids, DAY, DAY, clock=lambda: NOW)
    with pytest.raises(ValueError):
        MeteoFranceProvider((STATION,), NOW.date(), NOW.date(), clock=lambda: NOW)
    with pytest.raises(ValueError):
        csv_rows(b"a;b\n1\n")


def test_station_transport_failure_is_explicit_and_fails_run(tmp_path):
    instance, _ = provider()
    instance.prepare()
    instance.client.get.side_effect = RuntimeError("MeteoFrance network unavailable")
    manifest = run(
        instance, None, tmp_path, DAY, DAY, dry_run=True, clock=lambda: NOW, log=lambda _: None
    )
    assert not manifest["successful"]
    assert manifest["days"][0]["status"] == "missing"
    assert "station_unavailable" in manifest["days"][0]["quality_flags"]


def test_tmin_above_tmax_is_invalid():
    instance, _ = provider(CSV.replace(b";10,2;1;", b";50,0;1;"))
    assert batch(instance).status == "invalid"


@pytest.mark.parametrize(
    "field,value",
    [
        ("geo_id_insee", "12345678"),
        ("validity_time", "2026-10-13T11:00:00Z"),
        ("validity_time", "2026-10-14T13:00:00Z"),
        ("validity_time", "2026-10-14T11:00:00"),
    ],
)
def test_recent_sample_identity_and_time_are_checked(field, value):
    record = {
        "geo_id_insee": STATION,
        "validity_time": "2026-10-14T11:00:00Z",
        "t": 283.15,
        "u": 60,
        "rr1": 0,
    }
    record[field] = value
    instance, _ = provider(product="observations", sample=[record])
    with pytest.raises(ValueError):
        instance.download(NOW.date())
