"""Météo-France station adapters. No spatial interpolation or demo fallback.

DPClim v1 daily archive and DPObs v1 hourly samples are separate sources. API v2
requires a different subscription: never silently change version or credential.
"""

import csv
import hashlib
import io
import json
import os
import re
import time
from collections.abc import Callable
from contextlib import AbstractContextManager
from datetime import UTC, date, datetime, timedelta
from http.client import HTTPMessage, HTTPResponse
from pathlib import Path
from typing import IO, Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

from pydantic import Field

from .models import StrictModel
from .providers import FatalProviderError, SourcePayload
from .storage import SourceCache

API = "https://public-api.meteofrance.fr/public"
MVP_STATIONS = ("29075001", "67124001", "31069001", "13054001", "05046001")
DAILY_FIELDS = {
    "TN": ("temperature_min", "degC"),
    "TX": ("temperature_max", "degC"),
    "TM": ("temperature", "degC"),
    "UM": ("humidity", "%"),
    "RR": ("precipitation", "mm"),
    "ETPMON": ("etp_monteith", "mm"),
}


class Station(StrictModel):
    id: str = Field(pattern=r"^\d{8}$")
    name: str = Field(min_length=1)
    latitude: float = Field(ge=41, le=52, allow_inf_nan=False)
    longitude: float = Field(ge=-6, le=10, allow_inf_nan=False)
    altitude_m: float = Field(allow_inf_nan=False)
    metadata: dict[str, object]


class MeteoFranceAccessError(FatalProviderError):
    """Safe message names the required variable and HTTP status, never its value."""


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(
        self, req: Request, fp: IO[bytes], code: int, msg: str, headers: HTTPMessage, newurl: str
    ) -> None:
        return None  # Never forward a credential to an unverified redirect target.


class MeteoFranceClient:
    def __init__(
        self,
        product: Literal["climatology", "observations"],
        *,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
        opener: Callable[..., AbstractContextManager[HTTPResponse]] | None = None,
    ):
        self.variable = (
            "METEOFRANCE_CLIMATOLOGY_API_KEY"
            if product == "climatology"
            else "METEOFRANCE_OBSERVATIONS_API_KEY"
        )
        if not os.environ.get(self.variable):
            raise MeteoFranceAccessError(f"Missing {self.variable}")
        self.prefix = "DPClim/v1" if product == "climatology" else "DPObs/v1"
        self.sleep, self.clock = sleep, clock
        self.opener = opener or build_opener(NoRedirect()).open
        self.last_request = float("-inf")

    def get(self, path: str, parameters: dict[str, str] | None = None) -> tuple[int, bytes]:
        url = f"{API}/{self.prefix}/{path}"
        if parameters:
            url += "?" + urlencode(parameters)
        for attempt in range(3):
            # One serial worker, <=92 requests/minute including polls/retries.
            self.sleep(max(0, 0.65 - (self.clock() - self.last_request)))
            self.last_request = self.clock()
            request = Request(
                url,
                headers={
                    "apikey": os.environ[self.variable],
                    "Accept": "application/json,text/csv",
                },
            )
            try:
                with self.opener(request, timeout=30) as response:
                    content = response.read(10_000_001)
                    status = response.status
                if len(content) > 10_000_000:
                    raise ValueError("MeteoFrance response exceeds byte limit")
                return status, content
            except HTTPError as error:
                if error.code in {401, 403}:
                    raise MeteoFranceAccessError(
                        f"{self.variable}: HTTP {error.code}; subscription {self.prefix} required"
                    ) from None
                if error.code not in {408, 429, 500, 502, 503, 504} or attempt == 2:
                    raise RuntimeError(f"MeteoFrance HTTP {error.code}") from None
                delay = error.headers.get("Retry-After", "") if error.headers else ""
                self.sleep(min(float(delay), 30) if delay.isdigit() else 2**attempt)
            except (URLError, TimeoutError, OSError):
                if attempt == 2:
                    raise RuntimeError("MeteoFrance network unavailable") from None
                self.sleep(2**attempt)
        raise RuntimeError("MeteoFrance retries exhausted")


def csv_rows(content: bytes) -> list[dict[str, str]]:
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    if not reader.fieldnames or len(set(reader.fieldnames)) != len(reader.fieldnames):
        raise ValueError("Invalid source CSV header")
    rows = list(reader)
    if any(None in row or any(value is None for value in row.values()) for row in rows):
        raise ValueError("Invalid source CSV row")
    return rows


def number(value: str | float | None) -> float | None:
    if value is None or value == "":
        return None
    return float(str(value).replace(",", "."))


class MeteoFranceProvider:
    demo = False
    publication_time_known = False

    def __init__(
        self,
        stations: tuple[str, ...],
        start: date,
        end: date,
        *,
        product: Literal["climatology", "observations"] = "climatology",
        client: MeteoFranceClient | None = None,
        cache_root: Path | None = None,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ):
        if (
            not 1 <= len(stations) <= 10
            or len(set(stations)) != len(stations)
            or any(not re.fullmatch(r"\d{8}", station) for station in stations)
        ):
            raise ValueError("One to ten unique eight-digit station IDs required")
        if (
            end < start
            or (end - start).days > 365
            or end >= clock().date()
            and product == "climatology"
        ):
            raise ValueError("Daily archive range: at most 366 past dates")
        if product == "observations" and (start != end or start != clock().date()):
            raise ValueError("Recent hourly samples require today's UTC partition")
        self.station_ids, self.start, self.end = stations, start, end
        self.product, self.sleep, self.clock = product, sleep, clock
        self.source_id = f"meteofrance-{product}"
        self.client = client or MeteoFranceClient(product)
        self.cache = SourceCache(cache_root) if cache_root else None
        self.stations: tuple[Station, ...] = ()
        self.archives: dict[str, tuple[list[dict[str, str]], str]] = {}
        self.failures: set[str] = set()
        self.prepared = False

    def save(self, content: bytes) -> str:
        checksum = hashlib.sha256(content).hexdigest()
        if self.cache:
            self.cache.save(content)
        return checksum

    def prepare(self) -> None:
        if self.prepared:
            return
        catalog: dict[str, Station] = {}
        if self.product == "observations":
            _, content = self.client.get("liste-stations")
            checksum = self.save(content)
            for row in csv_rows(content):
                if row["Id_station"] in self.station_ids:
                    catalog[row["Id_station"]] = Station(
                        id=row["Id_station"],
                        name=row["Nom_usuel"],
                        latitude=float(row["Latitude"]),
                        longitude=float(row["Longitude"]),
                        altitude_m=float(row["Altitude"]),
                        metadata={**row, "catalog_checksum": checksum, "api_version": "DPObs/v1"},
                    )
        else:
            for department in sorted({station[:2] for station in self.station_ids}):
                _, content = self.client.get(
                    "liste-stations/quotidienne", {"id-departement": department}
                )
                checksum = self.save(content)
                rows = json.loads(content)
                if not isinstance(rows, list):
                    raise TypeError("Invalid station catalog")
                for row in rows:
                    station_id = str(row["id"]).zfill(8)
                    if station_id in self.station_ids:
                        catalog[station_id] = Station(
                            id=station_id,
                            name=row["nom"],
                            latitude=row["lat"],
                            longitude=row["lon"],
                            altitude_m=row["alt"],
                            metadata={
                                **row,
                                "catalog_checksum": checksum,
                                "api_version": "DPClim/v1",
                            },
                        )
        if set(catalog) != set(self.station_ids):
            raise ValueError("Selected station not in source catalog; inspect selection")
        self.stations = tuple(catalog[station] for station in self.station_ids)
        self.prepared = True

    def archive(self, station: str) -> tuple[list[dict[str, str]], str]:
        _, response = self.client.get(
            "commande-station/quotidienne",
            {
                "id-station": station,
                "date-deb-periode": f"{self.start}T00:00:00Z",
                "date-fin-periode": f"{self.end}T23:59:59Z",
            },
        )
        order = str(json.loads(response)["elaboreProduitAvecDemandeResponse"]["return"])
        if not order.isdigit():
            raise ValueError("Invalid archive order")
        # 204 = still processing; bounded polling, no unbounded sleep.
        for poll in range(12):
            status, content = self.client.get("commande/fichier", {"id-cmde": order})
            if status in {200, 201}:
                rows = csv_rows(content)
                fields = csv.DictReader(
                    io.StringIO(content.decode("utf-8-sig")), delimiter=";"
                ).fieldnames
                if not {"POSTE", "DATE", "TN", "TX", "TM", "RR", "UM"}.issubset(fields or []):
                    raise ValueError("Unrecognized daily archive format")
                dates: set[str] = set()
                for row in rows:
                    day = datetime.strptime(row["DATE"], "%Y%m%d").date()
                    if (
                        row["POSTE"].zfill(8) != station
                        or not self.start <= day <= self.end
                        or row["DATE"] in dates
                    ):
                        raise ValueError("Archive station/date/duplicate mismatch")
                    dates.add(row["DATE"])
                return rows, self.save(content)
            if status != 204:
                raise RuntimeError("Unexpected archive polling status")
            self.sleep(min(2**poll, 10))
        raise RuntimeError("MeteoFrance archive not ready; replay the range")

    def download(self, day: date) -> SourcePayload:
        self.prepare()
        if not self.start <= day <= self.end:
            raise ValueError("Day outside prepared range")
        rows: list[dict[str, object]] = []
        for station in self.station_ids:
            if self.product == "climatology":
                if station not in self.archives and station not in self.failures:
                    try:
                        self.archives[station] = self.archive(station)
                    except MeteoFranceAccessError:
                        raise
                    except RuntimeError:
                        self.failures.add(station)
                records, checksum = self.archives.get(station, ([], ""))
                record = next((row for row in records if row["DATE"] == day.strftime("%Y%m%d")), {})
                for field, (variable, unit) in DAILY_FIELDS.items():
                    flags = ["daily_source_date_label", "publication_time_unknown"]
                    if not record:
                        flags.append(
                            "station_unavailable"
                            if station in self.failures
                            else "source_day_absent"
                        )
                    if field not in record:
                        flags.append("variable_not_available")
                    if record.get("Q" + field):
                        flags.append("source_quality_code_" + record["Q" + field])
                    if field == "ETPMON":
                        flags.append("et0_equivalence_not_asserted")
                    rows.append(
                        {
                            "cell_id": station,
                            "variable": variable,
                            "observed_at": f"{day}T00:00:00Z",
                            "timezone": "UTC",
                            "value": number(record.get(field)),
                            "unit": unit,
                            "quality_flags": flags,
                            "source_field": field,
                            "source_checksum": checksum or None,
                            "temporal_resolution": "daily",
                        }
                    )
            else:
                try:
                    _, content = self.client.get(
                        "station/horaire",
                        {
                            "id_station": station,
                            "format": "json",
                        },
                    )
                except MeteoFranceAccessError:
                    raise
                except RuntimeError:
                    self.failures.add(station)
                    continue
                checksum = self.save(content)
                records = json.loads(content)
                if not isinstance(records, list) or len(records) > 1:
                    raise ValueError("Invalid hourly sample format")
                for record in records:
                    stamp = datetime.fromisoformat(record["validity_time"])
                    if (
                        str(record["geo_id_insee"]).zfill(8) != station
                        or stamp.utcoffset() != timedelta(0)
                        or stamp.date() != day
                        or stamp > self.clock()
                    ):
                        raise ValueError("Hourly sample station/time mismatch")
                    for field, variable, unit in (
                        ("t", "temperature", "K"),
                        ("u", "humidity", "%"),
                        ("rr1", "precipitation", "mm"),
                    ):
                        rows.append(
                            {
                                "cell_id": station,
                                "variable": variable,
                                "observed_at": stamp.isoformat(),
                                "timezone": "UTC",
                                "value": number(record.get(field)),
                                "unit": unit,
                                "quality_flags": [
                                    "recent_sample_not_daily_aggregate",
                                    "publication_time_unknown",
                                    "et0_not_available",
                                ],
                                "source_field": field,
                                "source_checksum": checksum,
                                "temporal_resolution": "hourly",
                            }
                        )
        # Daily timestamp is a source date LABEL, not an instantaneous measurement.
        # Publication is unavailable: leave it null, never substitute retrieval or
        # source date. Observation freshness is independently derived by normalize.
        envelope = {
            "published_at": None,
            "expected_count": len(self.station_ids) * (6 if self.product == "climatology" else 3),
            "rows": rows,
        }
        return SourcePayload(
            json.dumps(envelope, sort_keys=True, allow_nan=False).encode(), self.clock()
        )

    def decode(self, content: bytes) -> object:
        return json.loads(content)
