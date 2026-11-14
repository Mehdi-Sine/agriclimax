"""Local candidate store. No published archive, database, or editorial writes."""
from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Sequence
from datetime import date, timedelta
from pathlib import Path
from typing import TypedDict, cast

from agriclimax.climate.national_support import Datum, QualifiedDatum, from_sim, select_window
from agriclimax.climate.safran import DailyValue
from agriclimax.territories.weather_archive import decode, encode

LIMIT = 16 * 1024**2


class Entry(TypedDict):
    sha256: str
    semantic_sha256: str
    bytes: int


class Index(TypedDict):
    version: str
    days: dict[str, list[Entry]]


def serialized(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


class CandidateStore:
    def __init__(self, root: Path) -> None:
        self.root = root

    def index(self) -> Index:
        path = self.root / "index.json"
        if not path.exists():
            return {"version": "sim-incremental-1", "days": {}}
        if path.stat().st_size > 1024**2:
            raise ValueError("Candidate index budget exceeded")
        value = cast(Index, json.loads(path.read_bytes()))
        if value["version"] != "sim-incremental-1" or len(value["days"]) > 730:
            raise ValueError("Invalid candidate catalogue")
        for day, entries in value["days"].items():
            date.fromisoformat(day)
            if not 1 <= len(entries) <= 2:
                raise ValueError("At most two candidate revisions per day")
            for entry in entries:
                if not re.fullmatch(r"[a-f0-9]{64}", entry["sha256"]):
                    raise ValueError("Invalid candidate digest")
        return value

    def read(self, day: date) -> list[DailyValue]:
        entries = self.index()["days"].get(str(day))
        if not entries:
            raise FileNotFoundError("SIM day missing; never carry forward a value")
        entry = entries[-1]
        path = self.root / "blobs" / (entry["sha256"] + ".json.gz")
        if path.stat().st_size != entry["bytes"] or path.stat().st_size > LIMIT:
            raise ValueError("Candidate size mismatch")
        doc = decode(path.read_bytes(), entry["sha256"])
        rows = cast(list[DailyValue], doc["rows"])
        if doc["date"] != str(day) or any(r["date"] != str(day) for r in rows):
            raise ValueError("Candidate day mismatch")
        return rows

    def put(self, day: date, rows: Sequence[DailyValue], *, today: date) -> bool:
        if day > today or day < today - timedelta(days=729):
            raise ValueError("Candidate retention is 730 unique days")
        if not rows or any(r["date"] != str(day) for r in rows):
            raise ValueError("Explicit nonempty candidate day required")
        if len({(r["pra_id"], r["variable"]) for r in rows}) != len(rows):
            raise ValueError("Duplicate candidate PRA/variable")
        # Metadata-only changes of a rolling national source do not duplicate a day.
        semantic = sha(serialized([{k: v for k, v in r.items()
                                    if k not in {"provenance", "data_freshness"}} for r in rows]))
        index = self.index()
        revisions = index["days"].get(str(day), [])
        if revisions and revisions[-1]["semantic_sha256"] == semantic:
            self.read(day)  # verify before treating an existing blob as reusable
            return False
        if revisions and day < today - timedelta(days=3):
            raise ValueError("Revision outside three-day window requires manual campaign")
        if len(revisions) == 2:
            raise ValueError("Two revisions already retained; preserve current index")
        raw = encode({"date": str(day), "rows": list(rows)})
        digest = sha(raw)
        if decode(raw, digest)["rows"] != list(rows):
            raise ValueError("Candidate archive roundtrip mismatch")
        index["days"] = {d: es for d, es in index["days"].items()
                         if d >= str(today - timedelta(days=729))}
        index["days"][str(day)] = [*revisions, {"sha256": digest,
                                    "semantic_sha256": semantic, "bytes": len(raw)}]
        used = sum(p.stat().st_size for p in self.root.rglob("*") if p.is_file())
        if used + len(raw) + len(serialized(index)) > LIMIT:
            raise ValueError("Candidate storage budget exceeded; preserve index")
        blobs = self.root / "blobs"
        blobs.mkdir(parents=True, exist_ok=True)
        target = blobs / (digest + ".json.gz")
        if target.exists() and target.read_bytes() != raw:
            raise ValueError("Immutable candidate conflict")
        target.write_bytes(raw)
        temporary = self.root / "index.tmp"
        temporary.write_bytes(serialized(index))
        temporary.replace(self.root / "index.json")  # commit pointer last
        # Only unreferenced candidate blobs, never published archives.
        keep = {e["sha256"] + ".json.gz" for es in index["days"].values() for e in es}
        for path in blobs.glob("*.json.gz"):
            if path.name not in keep:
                path.unlink()
        return True


def complement_window(
    era: Sequence[Datum], store: CandidateStore, pra_id: str, variable: str,
    start: date, end: date, *, enabled: bool = False,
) -> list[QualifiedDatum]:
    """ERA priority; missing/corrupt SIM never removes usable ERA. No Journal eligibility."""
    if not enabled:
        return []
    selected = select_window(era, pra_id, variable, start, end, enabled=True)
    if selected:
        return selected
    if end < start or (end - start).days >= 60:
        raise ValueError("One to sixty explicit days required")
    sim: list[Datum] = []
    try:
        for offset in range((end - start).days + 1):
            sim.extend(from_sim(r) for r in store.read(start + timedelta(days=offset))
                       if r["pra_id"] == pra_id and r["variable"] == variable)
        return select_window(sim, pra_id, variable, start, end, enabled=True)
    except (OSError, ValueError, KeyError, TypeError):
        return []
