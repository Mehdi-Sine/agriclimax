"""Source files and local reference persistence, independent of Supabase."""

import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Protocol

from .models import DayBatch


def atomic_write(path: Path, content: bytes) -> None:
    import os
    import tempfile

    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


class SourceCache:
    def __init__(self, root: Path):
        self.root = root

    def save(self, content: bytes) -> str:
        checksum = hashlib.sha256(content).hexdigest()
        path = self.root / f"{checksum}.source"
        if path.exists():
            if hashlib.sha256(path.read_bytes()).hexdigest() != checksum:
                raise ValueError("cache_checksum_mismatch")
        else:
            atomic_write(path, content)
        return checksum


class ObservationRepository(Protocol):
    def persist(self, batch: DayBatch) -> bool: ...


class SQLiteObservationRepository:
    """Atomic day replacement; invalid batches stay quarantined, never replace good data."""

    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        with sqlite3.connect(path) as connection:
            connection.execute("""CREATE TABLE IF NOT EXISTS batches (
                source_id TEXT, valid_date TEXT, checksum TEXT, payload TEXT,
                PRIMARY KEY(source_id, valid_date))""")
            connection.execute("""CREATE TABLE IF NOT EXISTS quarantine (
                source_id TEXT, valid_date TEXT, checksum TEXT, payload TEXT,
                PRIMARY KEY(source_id, valid_date, checksum))""")

    def persist(self, batch: DayBatch) -> bool:
        payload = batch.model_dump_json()
        with sqlite3.connect(self.path) as connection:
            connection.execute("BEGIN IMMEDIATE")
            if batch.status == "invalid":
                cursor = connection.execute(
                    "INSERT OR IGNORE INTO quarantine VALUES (?,?,?,?)",
                    (batch.source_id, str(batch.valid_date), batch.provenance.checksum, payload),
                )
                return cursor.rowcount == 1
            previous = connection.execute(
                "SELECT payload FROM batches WHERE source_id=? AND valid_date=?",
                (batch.source_id, str(batch.valid_date)),
            ).fetchone()
            if previous:
                old = DayBatch.model_validate_json(previous[0])

                def stable(value: DayBatch) -> object:
                    result = value.model_dump(mode="json")
                    result["provenance"].pop("retrieved_at")
                    for observation in result["observations"]:
                        observation["provenance"].pop("retrieved_at")
                    return result

                if stable(old) == stable(batch):
                    return False
                if (
                    batch.provenance.published_at is not None
                    and old.provenance.published_at is not None
                    and batch.provenance.published_at < old.provenance.published_at
                ):
                    raise ValueError("older_revision_rejected")
                if (
                    batch.provenance.published_at is None
                    and batch.provenance.retrieved_at < old.provenance.retrieved_at
                ):
                    raise ValueError("older_revision_rejected")
            connection.execute(
                "INSERT OR REPLACE INTO batches VALUES (?,?,?,?)",
                (batch.source_id, str(batch.valid_date), batch.provenance.checksum, payload),
            )
            return True

    def read_all(self) -> list[DayBatch]:
        with sqlite3.connect(self.path) as connection:
            rows = connection.execute(
                "SELECT payload FROM batches ORDER BY source_id, valid_date"
            ).fetchall()
        return [DayBatch.model_validate_json(row[0]) for row in rows]


def write_manifest(root: Path, manifest: dict[str, object]) -> None:
    atomic_write(
        root / f"{manifest['run_id']}.json",
        json.dumps(manifest, indent=2, allow_nan=False).encode(),
    )
