"""Discovery uses complete common source catalogues, never a guessed future run."""
import sys
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import patch

import pytest
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from national_weather_sources import PARAMETERS, Budget, latest_available_run


def ids(hour: int) -> list[str]:
    return [f"{p}___2026-11-06T{hour:02}.00.00Z" + ("_P1D" if v == "precipitation" else "") for v, p in PARAMETERS.items()]


def test_latest_common_run_ignores_future_and_incomplete_model(tmp_path):
    with patch("national_weather_sources.WcsProvider.catalogue", side_effect=[ids(0)+ids(6)+ids(12), ids(0)+ids(6)+ids(12)[:-1]]):
        assert latest_available_run(tmp_path, datetime(2026,11,6,13,tzinfo=UTC), Budget()).hour == 6
    with patch("national_weather_sources.WcsProvider.catalogue", return_value=ids(0)+ids(6)+ids(12)):
        assert latest_available_run(tmp_path, datetime(2026,11,6,8,tzinfo=UTC), Budget()).hour == 6


def test_no_complete_common_run_fails_without_acquiring_fields(tmp_path):
    with patch("national_weather_sources.WcsProvider.catalogue", side_effect=[ids(0),ids(6)]), patch("national_weather_sources.WcsProvider.field") as field:
        with pytest.raises(ValueError, match="retain prior publication"):
            latest_available_run(tmp_path, datetime(2026,11,6,8,tzinfo=UTC), Budget())
        field.assert_not_called()
