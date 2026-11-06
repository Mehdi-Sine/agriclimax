"""Publication failure never replaces a verified pointer; replay never heals by mutation."""

import copy
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from pra_weather_store import ArchiveStore, indexed_bytes


def test_storage_projection_deduplicates_shared_native_geometry():
    geometry = {"path": "support/shared.json.gz", "bytes": 200}
    catalogue = {"weather": [{"path": "weather/cycle", "bytes": 500}], "era5": [{"path": "era5/day", "bytes": 100}], "supports": [{"path": "support/day1", "bytes": 10, "geometry_entry": geometry}, {"path": "support/day2", "bytes": 11, "geometry_entry": geometry}]}
    assert indexed_bytes(catalogue) == 821


def test_candidate_validation_failure_cannot_touch_remote_transport():
    with patch.dict("os.environ", {"NEXT_PUBLIC_SUPABASE_URL": "https://yyfbpecxvxglzxopsmel.supabase.co", "SUPABASE_SECRET_KEY": "test"}), patch("pra_weather_store.build_opener") as transport:
        store = ArchiveStore()
        invalid = {"pra_count": 712, "rows": []}
        with pytest.raises(ValueError, match="713"):
            store.publish_weather(invalid)
        transport.assert_not_called()
        assert store.writes == store.requests == 0


def test_current_manifest_failure_retains_original_verified_pointer():
    old = b'old verified pointer'
    with patch.dict("os.environ", {"NEXT_PUBLIC_SUPABASE_URL": "https://yyfbpecxvxglzxopsmel.supabase.co", "SUPABASE_SECRET_KEY": "test"}):
        store = ArchiveStore()
        catalogue = {"weather": [{"run_date": "2026-11-06"}], "era5": []}
        prior = copy.deepcopy(catalogue)
        with patch.object(store, "request", side_effect=[old, RuntimeError("simulated transport failure")]) as requests, pytest.raises(RuntimeError, match="simulated"):
            store.publish_current(catalogue)
        assert requests.call_args_list[0].args[0].endswith("current.json")
        assert catalogue == prior
        assert store.writes == 0
