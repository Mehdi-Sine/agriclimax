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
        with patch.object(store, "checkpoint_catalogue", return_value="catalogues/test.json"), patch.object(store, "request", side_effect=[old, RuntimeError("simulated transport failure")]) as requests, pytest.raises(RuntimeError, match="simulated"):
            store.publish_current(catalogue)
        assert requests.call_args_list[0].args[0].endswith("current.json")
        assert catalogue == prior
        assert store.writes == 0


def test_native_binding_is_committed_only_after_all_immutable_objects(monkeypatch):
    import json

    from forecast_native_publication import binding_path, publish, stored_path

    archive = "a" * 64
    blob = "forecast-masks/blobs/" + "b" * 64 + ".json.gz"
    index = "forecast-masks/indexes/" + "c" * 64 + ".json.gz"
    candidate = {"archive_sha256": archive, "index": index, "bytes": 8,
                 "objects": {blob: b"blob", index: b"data"}}
    files: dict[str, bytes] = {}
    writes: list[str] = []
    fail = True

    class FakeStore:
        def __init__(self, read_only=False):
            self.writes = 0

        def request(self, path):
            if path.startswith("bucket/"):
                return b'{"id":"pra-climate-archives","public":false,"file_size_limit":8388608}'
            return files.get(path.removeprefix("object/pra-climate-archives/"), b"")

        def catalogue(self):
            return {"weather": [{"sha256": archive, "path": "weather/archive",
                                 "run_at": "2026-11-20T18:00:00+00:00", "run_date": "2026-11-20",
                                 "method_version": "pra-national-weather-daily-1"}]}

        def blob(self, path, checksum):
            return b"verified"

        def inventory(self):
            return {path: len(raw) for path, raw in files.items()}

        def put_immutable(self, path, raw):
            if path == stored_path(index, archive, "cycle") and fail:
                raise ValueError("interrupted index upload")
            if path not in files:
                writes.append(path)
                files[path] = raw
                self.writes += 1
            assert files[path] == raw

    monkeypatch.setattr("forecast_native_publication.ArchiveStore", FakeStore)
    with pytest.raises(ValueError, match="interrupted index upload"):
        publish(candidate)
    assert writes == [stored_path(blob, archive, "cycle")]
    assert binding_path(archive) not in files
    fail = False
    result = publish(candidate, protect_current=True)
    assert result["archive_sha256"] == archive
    assert writes == [stored_path(blob, archive, "cycle"), stored_path(index, archive, "cycle"), binding_path(archive)]
    assert json.loads(files[binding_path(archive)])["index_sha256"] == "c" * 64
    assert publish(candidate)["storage_writes"] == 0
