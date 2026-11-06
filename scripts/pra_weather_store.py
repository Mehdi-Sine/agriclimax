"""Private existing Supabase Storage transport; immutable blobs and a validated catalogue.

No schema/role changes, no table writes, no deletion, no raw meteorological grids.
"""

import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener

from agriclimax.ingestion.meteofrance import NoRedirect
from agriclimax.territories.national_daily import REFERENCE
from agriclimax.territories.national_weather import validate_document
from agriclimax.territories.weather_archive import decode, encode

BUCKET = "pra-climate-archives"
DEV_HOST = "yyfbpecxvxglzxopsmel.supabase.co"
MAX_OBJECT = 8 * 1024**2
STORAGE_GUARD = 900 * 1024**2


class ArchiveStore:
    def __init__(self, read_only: bool = False) -> None:
        base = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
        origin = urlsplit(base)
        if (
            origin.scheme != "https"
            or origin.hostname != DEV_HOST
            or origin.path
            or origin.query
            or origin.username
            or origin.password
            or not os.environ.get("SUPABASE_SECRET_KEY")
        ):
            raise ValueError("Configured private HTTPS Supabase origin required")
        self.base = base + "/storage/v1"
        self.read_only = read_only
        self.requests = 0
        self.writes = 0

    def request(
        self,
        path: str,
        method: str = "GET",
        body: bytes | None = None,
        upsert: bool = False,
    ) -> bytes:
        if self.read_only and method != "GET":
            raise RuntimeError("Read-only archive transport forbids remote mutations")
        if not re.fullmatch(r"[a-zA-Z0-9_./-]+", path) or ".." in path:
            raise ValueError("Invalid archive path")
        headers = {
            "apikey": os.environ["SUPABASE_SECRET_KEY"],
            "Content-Type": "application/json"
            if path.startswith("bucket") or path.endswith(".json")
            else "application/gzip",
        }
        if upsert:
            headers["x-upsert"] = "true"
        self.requests += 1
        try:
            with build_opener(NoRedirect()).open(
                Request(
                    self.base + "/" + path, data=body, headers=headers, method=method
                ),
                timeout=30,
            ) as response:
                raw = response.read(MAX_OBJECT + 1)
            if len(raw) > MAX_OBJECT:
                raise ValueError("Storage response budget exceeded")
            if method != "GET":
                self.writes += 1
            return bytes(raw)
        except HTTPError as error:
            if method == "GET" and error.code in {400, 404}:
                # Storage uses 400 for a missing object; permission errors remain failures.
                detail = json.loads(error.read(4096))
                if (
                    str(detail.get("statusCode")) == "404"
                    or detail.get("error") == "not_found"
                    or error.code == 404
                ):
                    return b""
            raise RuntimeError(
                f"Private archive HTTP {error.code}; no credential diagnostics"
            ) from None

    def ensure_bucket(self) -> None:
        buckets = json.loads(self.request("bucket"))
        existing = next((b for b in buckets if b["id"] == BUCKET), None)
        if existing:
            if existing["public"]:
                raise ValueError("Climate archive bucket must remain private")
            return
        self.request(
            "bucket",
            "POST",
            json.dumps(
                {
                    "id": BUCKET,
                    "name": BUCKET,
                    "public": False,
                    "file_size_limit": MAX_OBJECT,
                    "allowed_mime_types": ["application/gzip", "application/json"],
                }
            ).encode(),
        )

    def catalogue(self) -> dict[str, Any]:
        raw = self.request(f"object/{BUCKET}/catalogue.json")
        return (
            json.loads(raw)
            if raw
            else {"version": "pra-archive-catalogue-1", "weather": [], "era5": []}
        )

    def blob(self, path: str, checksum: str) -> bytes:
        raw = self.request(f"object/{BUCKET}/{path}")
        if hashlib.sha256(raw).hexdigest() != checksum:
            raise ValueError("Remote archive checksum mismatch")
        return raw

    def put_immutable(self, path: str, raw: bytes) -> bool:
        if not 0 < len(raw) <= MAX_OBJECT:
            raise ValueError("Archive object budget exceeded")
        old = self.request(f"object/{BUCKET}/{path}")
        if old:
            if old != raw:
                raise ValueError("Immutable archive collision")
            return False
        self.request(f"object/{BUCKET}/{path}", "POST", raw)
        if self.request(f"object/{BUCKET}/{path}") != raw:
            raise ValueError("Uploaded archive readback mismatch")
        return True

    def publish_weather(self, document: dict[str, Any]) -> dict[str, Any]:
        reference = json.loads(
            (Path("config/coverage") / REFERENCE / "reference.json").read_text()
        )
        expected_ids = {"pra:" + f["properties"]["code"] for f in reference["features"]}
        validate_document(document, expected_ids)
        raw = encode(document)
        checksum = hashlib.sha256(raw).hexdigest()
        restored = decode(raw, checksum)
        if restored != document:
            raise ValueError("Full weather restoration mismatch")
        dates = sorted({r["valid_date"] for r in document["rows"]})
        entry: dict[str, Any] = {
            "run_date": document["run"][:10],
            "run_at": document["run"],
            "sha256": checksum,
            "path": f"weather/{checksum}.json.gz",
            "bytes": len(raw),
            "dates": dates,
            "pra_count": document["pra_count"],
            "method_version": document["method_version"],
        }
        catalogue = self.catalogue()
        same = [
            e
            for e in catalogue["weather"]
            if e.get("run_at", e["run_date"] + "T00:00:00+00:00") == entry["run_at"]
            and e["method_version"] == entry["method_version"]
        ]
        if same:
            if same[0] != entry:
                raise ValueError("Published immutable weather cycle conflict")
            self.blob(entry["path"], checksum)
            return {**entry, "inserted": False, "storage_writes": 0}
        projected = sum(
            e["bytes"]
            for group in (catalogue["weather"], catalogue["era5"])
            for e in group
        ) + len(raw)
        if projected > STORAGE_GUARD:
            raise ValueError("Archive storage guard exceeded")
        self.put_immutable(entry["path"], raw)
        catalogue["weather"].append(entry)
        # A single workflow concurrency group serializes catalogue updates. Blob is immutable and verified first.
        self.request(
            f"object/{BUCKET}/catalogue.json",
            "POST",
            json.dumps(catalogue, sort_keys=True).encode(),
            upsert=True,
        )
        checked = self.catalogue()
        if entry not in checked["weather"]:
            raise ValueError("Catalogue readback mismatch")
        return {**entry, "inserted": True, "storage_writes": self.writes}

    def publish_era5(self, archive: Path, dates: list[str]) -> dict[str, Any]:
        raw = archive.read_bytes()
        checksum = hashlib.sha256(raw).hexdigest()
        if archive.with_suffix(".sha256").read_text().strip() != checksum:
            raise ValueError("Exact archive source checksum mismatch")
        entry: dict[str, Any] = {
            "dates": sorted(dates),
            "path": f"era5/{checksum}.json.gz",
            "sha256": checksum,
            "bytes": len(raw),
        }
        catalogue = self.catalogue()
        if entry in catalogue["era5"]:
            self.blob(entry["path"], checksum)
            return {**entry, "inserted": False}
        self.put_immutable(entry["path"], raw)
        catalogue["era5"].append(entry)
        self.request(
            f"object/{BUCKET}/catalogue.json",
            "POST",
            json.dumps(catalogue, sort_keys=True).encode(),
            upsert=True,
        )
        return {**entry, "inserted": True}
