"""Synthetic transport/cache tests for the splitter extracted from Task19D."""

import gzip
import hashlib
import json
from datetime import date
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from agriclimax.climate.coverage import compact
from agriclimax.climate.models import Dataset, ReferencePeriod
from agriclimax.territories.national_daily import acquire_groups
from agriclimax.territories.pipeline import digest
from agriclimax.territories.spatial import Weight


def source():
    dataset = Dataset(
        dataset_version="synthetic-group",
        reference_period=ReferencePeriod(start_year=1991, end_year=2020, minimum_years=24),
    )
    refs = []
    for x in range(21):
        for y in range(440, 461):
            lon, lat = x / 10, y / 10
            refs.append(
                SimpleNamespace(
                    longitude=lon,
                    latitude=lat,
                    cell_id=f"era5land.{lat:.1f}.{lon:.1f}",
                    source_request={"receipts": []},
                    batch=SimpleNamespace(
                        valid_date=date(2026, 1, 1),
                        observations=[
                            SimpleNamespace(
                                variable=v, value=None if x == 2 else 10, quality_flags=[]
                            )
                            for v in (
                                "temperature",
                                "temperature_min",
                                "temperature_max",
                                "precipitation",
                            )
                        ],
                    ),
                )
            )
    weights = [
        Weight(f"pra:0000{i}", f"era5land.{lat:.1f}.{lon:.1f}", lon, lat, 1, 1)
        for i, (lon, lat) in enumerate([(0.2, 44.2), (1.2, 44.2), (0.2, 45.2), (1.2, 45.2)])
    ]
    return Mock(dataset=dataset, acquire=Mock(return_value=refs)), refs, weights


def test_shared_two_degree_request_produces_exact_native_partitions_and_replays(tmp_path):
    provider, _refs, weights = source()
    day = date(2026, 1, 1)
    assert acquire_groups(provider, weights, day, tmp_path, 1) == (True, 1, 4)
    provider.acquire.assert_called_once_with((0, 44, 2, 46), day, day)
    paths = sorted((tmp_path / "tiles").glob("*.json.gz"))
    rows = [r for path in paths for r in json.loads(gzip.decompress(path.read_bytes()))["rows"]]
    assert len(rows) == 400 == len({r["cell_id"] for r in rows})
    assert any(r["temperature"] is None for r in rows)
    assert acquire_groups(provider, weights, day, tmp_path, 0) == (True, 0, 0)
    assert provider.acquire.call_count == 1


def test_existing_121_cell_checkpoint_is_retained_and_null_masks_cannot_change(tmp_path):
    provider, refs, weights = source()
    day = date(2026, 1, 1)
    key = digest(
        {
            "dataset": provider.dataset.model_dump(mode="json"),
            "start": str(day),
            "end": str(day),
            "west": 0,
            "south": 44,
            "compact_version": 1,
        }
    )
    path = tmp_path / "tiles" / f"{key}.json.gz"
    path.parent.mkdir(parents=True)
    rows = [compact(r) for r in refs if r.longitude <= 1 and r.latitude <= 45]
    content = gzip.compress(json.dumps({"rows": rows, "source": {"receipts": []}}).encode())
    path.write_bytes(content)
    path.with_suffix(".sha256").write_text(hashlib.sha256(content).hexdigest())
    assert len(rows) == 121
    assert acquire_groups(provider, weights, day, tmp_path, 1) == (True, 1, 3)
    assert path.read_bytes() == content
    # Honest checksum but conflicting native science must still be rejected.
    rows[0]["temperature"] = None
    changed = gzip.compress(json.dumps({"rows": rows, "source": {"receipts": []}}).encode())
    path.write_bytes(changed)
    path.with_suffix(".sha256").write_text(hashlib.sha256(changed).hexdigest())
    other = next(p for p in path.parent.glob("*.json.gz") if p != path)
    other.unlink()
    with pytest.raises(ValueError, match="source conflict"):
        acquire_groups(provider, weights, day, tmp_path, 1)
    assert path.read_bytes() == changed
