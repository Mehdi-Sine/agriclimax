import hashlib
import json
from datetime import date

import pytest

from agriclimax.climate.safran import METHOD, VARIABLES, CellWeight, aggregate
from agriclimax.climate.safran_archive import read_day
from agriclimax.territories.weather_archive import encode


def test_verified_read_missing_day_and_corruption(tmp_path):
    source = "a" * 64
    support = "b" * 64
    snapshot = tmp_path / source
    snapshot.mkdir()
    day = date(2026, 10, 1)
    rows = [
        aggregate(
            "pra:1",
            day,
            v,
            [CellWeight("a", 1)],
            {"a": {"T": 10, "HU": 80, "PRELIQ": 0, "PRENEI": 0, "TINF_H": 0, "TSUP_H": 20}},
            source_sha256=source,
            support_sha256=support,
            acquired_at="known",
        )
        for v in VARIABLES
    ]
    raw = encode(
        {
            "method": METHOD,
            "date": str(day),
            "source_sha256": source,
            "support_sha256": support,
            "rows": rows,
        }
    )
    path = snapshot / f"{day}.json.gz"
    path.write_bytes(raw)
    manifest = {
        "method": METHOD,
        "source_sha256": source,
        "support_sha256": support,
        "days": [{"date": str(day), "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}],
    }
    (snapshot / "manifest.json").write_text(json.dumps(manifest))
    assert read_day(snapshot, day, {"pra:1"}) == rows
    with pytest.raises(FileNotFoundError):
        read_day(snapshot, date(2026, 10, 2), {"pra:1"})
    with pytest.raises(ValueError):
        read_day(snapshot, day, {"pra:1", "pra:2"})
    path.write_bytes(b"x" + raw[1:])
    with pytest.raises(ValueError, match="checksum"):
        read_day(snapshot, day, {"pra:1"})
