from datetime import date, timedelta

from agriclimax.climate.forecast_continuity import homogeneous_indices


def rows():
    return [
        {
            "pra_id": "pra:1",
            "variable": "temperature",
            "valid_date": str(date(2026, 11, 8) + timedelta(days=i)),
            "model": "ifs",
            "model_run_at": "run",
            "nature": "forecast",
            "status": "available",
            "spatial_coverage": 1,
            "temporal_coverage": 1,
            "value": 12,
            "source_id": "ecmwf",
            "grid_version": "grid",
            "weights_sha256": "a" * 64,
            "unit": "degC",
            "rule_version": "v1",
            "valid_from": f"{date(2026, 11, 8) + timedelta(days=i)}T00:00:00Z",
            "valid_to": f"{date(2026, 11, 9) + timedelta(days=i)}T00:00:00Z",
        }
        for i in range(7)
    ]


def select(data):
    return homogeneous_indices(
        data,
        {"pra:1"},
        {"temperature"},
        date(2026, 11, 8),
        date(2026, 11, 14),
        model="ifs",
        run_at="run",
    )


def test_homogeneous_and_no_mutation():
    data = rows()
    assert select(data) == list(range(7))
    assert data == rows()


def test_missing_run_grid_and_duplicate_refused():
    assert select(rows()[:-1]) == []
    assert select(rows() + [rows()[0]]) == []
    for key, value in [
        ("model_run_at", "other"),
        ("weights_sha256", "other"),
        ("source_id", "other"),
        ("temporal_coverage", 0),
        ("value", None),
        ("valid_to", "other"),
    ]:
        data = rows()
        data[3][key] = value
        assert select(data) == []
