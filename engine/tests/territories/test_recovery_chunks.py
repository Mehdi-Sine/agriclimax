"""Synthetic planning test: bulk recovery preserves the default and cached tile/day keys."""

import hashlib
from datetime import date, timedelta
from types import SimpleNamespace

from agriclimax.climate.models import Dataset, ReferencePeriod
from agriclimax.territories import national_daily
from agriclimax.territories.pipeline import digest


def test_explicit_bulk_grouping_is_opt_in_and_never_redownloads_cached_days(tmp_path, monkeypatch):
    calls = []
    dataset = Dataset(
        dataset_version="unit-test",
        reference_period=ReferencePeriod(start_year=1991, end_year=2020, minimum_years=24),
    )

    def acquire(bbox, start, end):
        calls.append((start, end))
        return []

    def synthetic_tiles(refs, root, model, selected, windows):
        directory = root / "tiles"
        directory.mkdir(exist_ok=True)
        for start, end in windows:
            for x, y in selected:
                key = digest(
                    {
                        "dataset": model.model_dump(mode="json"),
                        "start": str(start),
                        "end": str(end),
                        "west": x,
                        "south": y,
                        "compact_version": 1,
                    }
                )
                path = directory / (key + ".json.gz")
                path.write_bytes(b"planning-only-not-native-data")
                path.with_suffix(".sha256").write_text(
                    hashlib.sha256(path.read_bytes()).hexdigest()
                )
        return len(windows) * len(selected)

    monkeypatch.setattr("agriclimax.territories.pipeline.write_native_tiles", synthetic_tiles)
    provider = SimpleNamespace(dataset=dataset, acquire=acquire)
    start = date(2026, 10, 2)
    by_day = {
        start + timedelta(days=i): [SimpleNamespace(longitude=0.1, latitude=48.1)]
        for i in range(17)
    }
    ready, groups, created = national_daily.acquire_windows(provider, by_day, tmp_path, 64)
    assert ready and groups == 3 and created == 17
    assert calls == [
        (date(2026, 10, 2), date(2026, 10, 8)),
        (date(2026, 10, 9), date(2026, 10, 15)),
        (date(2026, 10, 16), date(2026, 10, 18)),
    ]
    calls.clear()
    assert national_daily.acquire_windows(provider, by_day, tmp_path, 64, max_chunk_days=17) == (
        True,
        0,
        0,
    )
    assert calls == []
    root = tmp_path / "bulk"
    root.mkdir()
    assert national_daily.acquire_windows(provider, by_day, root, 64, max_chunk_days=17) == (
        True,
        1,
        17,
    )
    assert calls == [(date(2026, 10, 2), date(2026, 10, 18))]
