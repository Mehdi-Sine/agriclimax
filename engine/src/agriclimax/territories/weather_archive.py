"""Lossless dictionary/column encoding for PRA weather; raw grids are excluded."""

import gzip
import hashlib
import io
import json
from typing import Any

VERSION = "pra-weather-columnar-1"
MAX_ROWS = 100_000
MAX_INFLATED = 32 * 1024**2


def encode(document: dict[str, Any]) -> bytes:
    rows = document["rows"]
    if not isinstance(rows, list) or not 0 < len(rows) <= MAX_ROWS:
        raise ValueError("Bounded nonempty weather rows required")
    keys = list(rows[0])
    if any(set(row) != set(keys) for row in rows):
        raise ValueError("Row contracts differ")
    columns: dict[str, Any] = {}
    for key in keys:
        values = [row[key] for row in rows]
        if all(
            v is None or isinstance(v, (int, float)) and not isinstance(v, bool) for v in values
        ):
            columns[key] = {"values": values}
        else:
            dictionary: list[Any] = []
            codes: list[int] = []
            seen: dict[str, int] = {}
            for value in values:
                token = json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)
                if token not in seen:
                    seen[token] = len(dictionary)
                    dictionary.append(value)
                codes.append(seen[token])
            columns[key] = {"dictionary": dictionary, "codes": codes}
    packed = {
        "archive_version": VERSION,
        "count": len(rows),
        "metadata": {k: v for k, v in document.items() if k != "rows"},
        "columns": columns,
    }
    raw = json.dumps(packed, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    if len(raw) > MAX_INFLATED:
        raise ValueError("Archive exceeds inflation budget")
    return gzip.compress(raw, mtime=0)


def decode(content: bytes, expected_sha256: str) -> dict[str, Any]:
    if hashlib.sha256(content).hexdigest() != expected_sha256:
        raise ValueError("Archive checksum mismatch")
    with gzip.GzipFile(fileobj=io.BytesIO(content)) as stream:
        raw = stream.read(MAX_INFLATED + 1)
    if len(raw) > MAX_INFLATED:
        raise ValueError("Archive inflation budget exceeded")
    packed = json.loads(raw)
    count = packed["count"]
    if packed["archive_version"] != VERSION or type(count) is not int or not 0 < count <= MAX_ROWS:
        raise ValueError("Unsupported archive/count")
    rows: list[dict[str, Any]] = [{} for _ in range(count)]
    for key, column in packed["columns"].items():
        if "values" in column:
            values = column["values"]
        else:
            dictionary, codes = column["dictionary"], column["codes"]
            if any(type(c) is not int or not 0 <= c < len(dictionary) for c in codes):
                raise ValueError("Invalid archive dictionary reference")
            values = [dictionary[c] for c in codes]
        if len(values) != count:
            raise ValueError("Incomplete archive column")
        for row, value in zip(rows, values, strict=True):
            row[key] = value
    return {**packed["metadata"], "rows": rows}
