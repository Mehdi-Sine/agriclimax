"""Synthetic request-plan tests; real network evidence lives in workflow receipts."""

from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import patch

from agriclimax.territories.national_daily import acquire_windows


def test_seven_days_share_one_acquisition_and_resume_without_download(tmp_path):
    days = [date(2026, 10, 20) + timedelta(days=i) for i in range(7)]
    weights = [SimpleNamespace(longitude=1.2, latitude=48.2)]
    calls = []
    dataset = SimpleNamespace(model_dump=lambda **kw: {"version": "synthetic"})
    provider = SimpleNamespace(dataset=dataset, acquire=lambda *args: calls.append(args) or [])
    with patch("agriclimax.territories.pipeline.write_native_tiles", return_value=7) as write:
        assert acquire_windows(provider, {d: weights for d in days}, tmp_path, 1) == (True, 1, 7)
        assert calls == [((0, 48, 2, 50), days[0], days[-1])]
        assert write.call_args.args[-1] == [(d, d) for d in days]


def test_gap_never_acquires_a_persisted_day_and_budget_is_bounded(tmp_path):
    weights = [SimpleNamespace(longitude=1.2, latitude=48.2)]
    calls = []
    provider = SimpleNamespace(
        dataset=SimpleNamespace(model_dump=lambda **kw: {}),
        acquire=lambda *args: calls.append(args) or [],
    )
    with patch("agriclimax.territories.pipeline.write_native_tiles", return_value=1):
        assert acquire_windows(
            provider, {date(2026, 10, 20): weights, date(2026, 10, 22): weights}, tmp_path, 1
        ) == (False, 1, 1)
        assert calls[0][1:] == (date(2026, 10, 20), date(2026, 10, 20))
