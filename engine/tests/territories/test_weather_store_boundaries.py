"""Read-only replay must fail before transport; publication is DEV-host bound."""

import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from pra_weather_store import ArchiveStore


def test_readonly_replay_blocks_every_mutation_before_network():
    with patch.dict(
        "os.environ",
        {
            "NEXT_PUBLIC_SUPABASE_URL": "https://yyfbpecxvxglzxopsmel.supabase.co",
            "SUPABASE_SECRET_KEY": "test",
        },
    ), patch("pra_weather_store.build_opener") as transport:
        store = ArchiveStore(read_only=True)
        for method in ("POST", "PUT", "PATCH", "DELETE"):
            with pytest.raises(RuntimeError, match="Read-only"):
                store.request("object/pra-climate-archives/catalogue.json", method, b"{}")
        transport.assert_not_called()
        assert store.requests == store.writes == 0


def test_writer_rejects_any_other_host_before_transport():
    with patch.dict(
        "os.environ",
        {
            "NEXT_PUBLIC_SUPABASE_URL": "https://production.example.com",
            "SUPABASE_SECRET_KEY": "test",
        },
    ), pytest.raises(ValueError, match="Configured private HTTPS"):
        ArchiveStore()
