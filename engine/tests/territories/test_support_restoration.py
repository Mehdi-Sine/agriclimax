"""Native ownership, variable-specific supports and refusal of corrupted checkpoints."""

import gzip
import hashlib
import json
from pathlib import Path

import pytest
from scripts.era5_spatial_restitution import build
from shapely.geometry import box, mapping

from agriclimax.climate.models import Dataset, ReferencePeriod
from agriclimax.territories.national_daily import DATASET
from agriclimax.territories.pipeline import digest
from agriclimax.territories.spatial import projected


def fixture(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    directory = Path("config/coverage/ofb-masa-pra-2017-snapshot-20261017")
    directory.mkdir(parents=True)
    geometry = mapping(box(-0.05, 47.95, 0.25, 48.05).segmentize(0.01))
    polygon = projected(geometry)
    feature = {"type": "Feature", "properties": {"code": "99999"}, "geometry": geometry}
    (directory / "reference.json").write_text(json.dumps({"features": [feature]}))
    weights = []
    rows = []
    for i, lon in enumerate([0, 0.1, 0.2]):
        cell = f"era5land.48.0.{lon:.1f}"
        footprint = projected(mapping(box(lon - 0.05, 47.95, lon + 0.05, 48.05).segmentize(0.01)))
        weights.append(
            {
                "pra_id": "pra:99999",
                "cell_id": cell,
                "longitude": lon,
                "latitude": 48,
                "weight": polygon.intersection(footprint).area / polygon.area,
            }
        )
        rows.append(
            {
                "cell_id": cell,
                "longitude": lon,
                "latitude": 48,
                "valid_date": "2026-10-25",
                "temperature": [10, 12, None][i],
                "temperature_min": [-2, None, None][i],
                "temperature_max": [None, 25, 27][i],
                "precipitation": [0, 2, None][i],
                "quality_flags": ["24_hourly_samples_required"],
            }
        )
    (directory / "weights.json").write_text(json.dumps(weights))
    model = Dataset(
        dataset_version=DATASET,
        reference_period=ReferencePeriod(start_year=1991, end_year=2020, minimum_years=24),
    ).model_dump(mode="json")
    key = digest(
        {
            "dataset": model,
            "start": "2026-10-25",
            "end": "2026-10-25",
            "west": 0,
            "south": 48,
            "compact_version": 1,
        }
    )
    root = Path("checkpoint")
    (root / "tiles").mkdir(parents=True)
    path = root / "tiles" / (key + ".json.gz")

    def write(native):
        raw = gzip.compress(
            json.dumps({"rows": native, "source": {"catalogue": "reanalysis-era5-land"}}).encode(),
            mtime=0,
        )
        path.write_bytes(raw)
        path.with_suffix(".sha256").write_text(hashlib.sha256(raw).hexdigest())

    write(rows)
    return root, rows, weights, write, path


def test_native_extrema_use_separate_masks_and_no_90_percent_extrapolation(tmp_path, monkeypatch):
    root, rows, weights, write, _ = fixture(tmp_path, monkeypatch)
    # Legacy east boundary belongs to the next one-degree tile, never this tile.
    write(
        rows + [{**rows[0], "cell_id": "era5land.48.0.1.0", "longitude": 1, "temperature_max": 65}]
    )
    build(
        root,
        Path("out.json"),
        variables=("temperature", "temperature_min", "temperature_max", "precipitation"),
    )
    result = json.loads(Path("out.json").read_text())
    daily = result["days"]["2026-10-25"]
    assert daily["temperature_min"][0]["observed_value"] == -2
    assert daily["temperature_max"][0]["observed_value"] == 27
    assert daily["temperature_max"][0]["value"] is None
    assert daily["temperature_min"][0]["support_id"] != daily["temperature_max"][0]["support_id"]
    expected = (10 * weights[0]["weight"] + 12 * weights[1]["weight"]) / (
        weights[0]["weight"] + weights[1]["weight"]
    )
    assert daily["temperature"][0]["observed_value"] == pytest.approx(expected)
    assert result["border_rows_excluded"] == 1
    assert result["network_requests"] == 0


def test_missing_coordinates_are_not_a_native_null_mask(tmp_path, monkeypatch):
    root, rows, _, write, _ = fixture(tmp_path, monkeypatch)
    write(rows[:-1])
    with pytest.raises(ValueError, match="coordinate inventory"):
        build(root, Path("out.json"))


def test_corrupt_sha_is_rejected_before_qualification(tmp_path, monkeypatch):
    root, _, _, _, path = fixture(tmp_path, monkeypatch)
    path.with_suffix(".sha256").write_text("0" * 64)
    with pytest.raises(ValueError, match="Corrupt"):
        build(root, Path("out.json"))
