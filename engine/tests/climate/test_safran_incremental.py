from copy import deepcopy
from datetime import date, timedelta

import pytest

from agriclimax.climate.national_support import Datum
from agriclimax.climate.safran import CellWeight, aggregate
from agriclimax.climate.safran_incremental import CandidateStore, complement_window

TODAY = date(2026, 11, 14)
DAY = TODAY - timedelta(days=1)


def row(day=DAY):
    return aggregate("pra:29102", day, "temperature_mean", [CellWeight("a", .95)],
                     {"a": {"T": 12}}, source_sha256="a"*64,
                     support_sha256="b"*64, acquired_at="2026-11-14T08:00:00Z")


def test_idempotence_metadata_revision_and_atomic_failure(tmp_path):
    store = CandidateStore(tmp_path)
    first = row()
    assert store.put(DAY, [first], today=TODAY)
    index = (tmp_path / "index.json").read_bytes()
    changed = deepcopy(first)
    changed['provenance'] = 'c'*64
    changed['data_freshness'] = '2026-11-15T08:00:00Z'
    assert not store.put(DAY, [changed], today=TODAY)
    assert (tmp_path / "index.json").read_bytes() == index
    changed['partial_value'] = 14
    assert store.put(DAY, [changed], today=TODAY)
    assert store.read(DAY)[0]['partial_value'] == 14
    index = (tmp_path / "index.json").read_bytes()
    changed['partial_value'] = 15
    with pytest.raises(ValueError, match='Two revisions'):
        store.put(DAY, [changed], today=TODAY)
    assert (tmp_path / "index.json").read_bytes() == index


def test_old_revision_and_retention(tmp_path):
    store = CandidateStore(tmp_path)
    old = TODAY - timedelta(days=10)
    original = row(old)
    store.put(old, [original], today=TODAY)
    original['partial_value'] = 20
    with pytest.raises(ValueError, match='manual campaign'):
        store.put(old, [original], today=TODAY)
    with pytest.raises(ValueError, match='730'):
        store.put(TODAY-timedelta(days=730), [row()], today=TODAY)


def test_missing_delayed_corrupt_and_era_priority(tmp_path):
    store = CandidateStore(tmp_path)
    era = Datum('pra:29102', DAY, 'temperature_mean', 8, 1, True, 'era5-land',
                'ERA5-Land', 'reanalysis', 'degC', '00UTC-24UTC_hourly', 'area_mean',
                'c'*64, ('d'*64,), 'native', '2026-11-14T08:00:00Z')
    def read(rows=(), start=DAY, end=DAY, enabled=True):
        return complement_window(rows, store, 'pra:29102', 'temperature_mean',
                                 start, end, enabled=enabled)
    assert read() == []
    assert read([era], enabled=False) == []
    assert read([era])[0]['value'] == 8
    store.put(DAY, [row()], today=TODAY)
    assert read()[0]['observed_value'] == pytest.approx(12)
    assert read()[0]['quality']['journal_eligible'] is False
    assert read()[0]['quality']['indicator_eligible'] is False
    assert read(end=TODAY) == []  # delayed next day, never reuse yesterday
    assert read([era])[0]['source'] == 'era5-land'
    next((tmp_path/'blobs').glob('*')).write_bytes(b'corrupt')
    assert read() == []
    assert read([era])[0]['value'] == 8
