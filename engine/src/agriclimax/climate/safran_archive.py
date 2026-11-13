"""Explicit, checksum-verified local SIM snapshot reader. No automatic source fallback."""

from __future__ import annotations

import hashlib
import json
from datetime import date
from pathlib import Path
from typing import cast

from agriclimax.climate.safran import METHOD, VARIABLES, DailyValue
from agriclimax.territories.weather_archive import decode


def read_day(snapshot: Path, day: date, pra_ids: set[str]) -> list[DailyValue]:
    raw_manifest = (snapshot / "manifest.json").read_bytes()
    if len(raw_manifest) > 1024**2:
        raise ValueError("Oversize snapshot manifest")
    manifest = json.loads(raw_manifest)
    source = manifest["source_sha256"]
    if manifest["method"] != METHOD or snapshot.name != source:
        raise ValueError("Explicit method/source snapshot required")
    days = manifest["days"]
    if len(days) > 60 or len({e["date"] for e in days}) != len(days):
        raise ValueError("Duplicate or oversize date catalogue")
    entry = next((e for e in days if e["date"] == str(day)), None)
    if entry is None:
        raise FileNotFoundError("Missing actual day; no interpolation or fallback")
    path = snapshot / f"{day}.json.gz"
    if path.stat().st_size != entry["bytes"] or path.stat().st_size > 8 * 1024**2:
        raise ValueError("Archive size mismatch/budget exceeded")
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != entry["sha256"]:
        raise ValueError("Archive checksum mismatch")
    doc = decode(raw, entry["sha256"])
    if (
        doc["method"] != METHOD
        or doc["date"] != str(day)
        or doc["source_sha256"] != source
        or doc["support_sha256"] != manifest["support_sha256"]
    ):
        raise ValueError("Source/day/support mismatch")
    rows = doc["rows"]
    expected = {(pra, variable) for pra in pra_ids for variable in VARIABLES}
    if len(rows) != len(expected) or {(r["pra_id"], r["variable"]) for r in rows} != expected:
        raise ValueError("Missing/duplicate PRA or variable")
    if any(
        r["date"] != str(day) or r["provenance"] != source or r["rule_version"] != METHOD
        for r in rows
    ):
        raise ValueError("Row source/day/method mismatch")
    return cast(list[DailyValue], rows)
