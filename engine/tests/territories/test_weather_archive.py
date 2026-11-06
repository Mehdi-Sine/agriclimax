"""Real scientific weather roundtrip, independent bit preservation and corruption guards."""

import gzip
import hashlib
import json
import struct
from pathlib import Path

import pytest

from agriclimax.territories.weather_archive import decode, encode


def test_real_forecast_archive_restores_all_fields_and_float_bits():
    source = Path(__file__).resolve().parents[3] / "apps/web/data/operational/cycle.json"
    original = json.loads(source.read_text())
    packed = encode(original)
    restored = decode(packed, hashlib.sha256(packed).hexdigest())
    assert restored == original
    assert encode(restored) == packed
    for a, b in zip(original["rows"], restored["rows"], strict=True):
        for key in ("value", "spatial_coverage", "temporal_coverage"):
            if a[key] is not None:
                assert struct.pack("!d", a[key]) == struct.pack("!d", b[key])
    assert len(packed) < len(source.read_bytes()) / 10


def test_corrupt_cold_archive_cannot_be_read():
    blob = encode({"rows": [{"value": 1.01, "quality": None}]})
    with pytest.raises(ValueError, match="checksum"):
        decode(blob + b"broken", hashlib.sha256(blob).hexdigest())


def test_invalid_dictionary_pointer_rejected():
    blob = encode({"rows": [{"value": None, "quality": "partial"}]})
    raw = json.loads(gzip.decompress(blob))
    raw["columns"]["quality"]["codes"] = [-1]
    bad = gzip.compress(json.dumps(raw).encode())
    with pytest.raises(ValueError, match="dictionary"):
        decode(bad, hashlib.sha256(bad).hexdigest())


def test_nonfinite_scientific_value_cannot_enter_archive():
    with pytest.raises(ValueError):
        encode({"rows": [{"value": float("nan")}]})
