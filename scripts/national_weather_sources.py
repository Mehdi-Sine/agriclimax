"""Shared bounded WCS acquisition/cache, independent of the number of PRA."""

import hashlib
import json
import math
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from agriclimax.ingestion.storage import atomic_write
from probe_operational_access import (
    MODELS,
    ORIGIN,
    capabilities,
    fetch,
    field_parameters,
    xml_root,
)

BBOX = (-6.0, 40.5, 10.5, 52.0)
TILES = ((-6.0, 42.0, 8.5, 52.0), (8.0, 41.0, 10.0, 43.5))
PARAMETERS = {
    "temperature": "TEMPERATURE__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND",
    "humidity": "RELATIVE_HUMIDITY__SPECIFIC_HEIGHT_LEVEL_ABOVE_GROUND",
    "precipitation": "TOTAL_PRECIPITATION__GROUND_OR_WATER_SURFACE",
}


@dataclass
class Budget:
    started: float = field(default_factory=time.monotonic)
    requests: int = 0
    bytes: int = 0
    seconds_limit: int = 1320
    requests_limit: int = 512
    bytes_limit: int = 128 * 1024**2
    last_request: float = 0

    def before(self) -> None:
        if (
            self.requests >= self.requests_limit
            or self.bytes >= self.bytes_limit
            or time.monotonic() - self.started > self.seconds_limit
        ):
            raise RuntimeError(
                "National cycle resource budget exhausted; retain checkpoints"
            )
        # Each API advertises 100 requests/minute; one global request/second is conservative.
        remaining = 1.0 - (time.monotonic() - self.last_request)
        if remaining > 0:
            time.sleep(remaining)
        self.requests += 1
        self.last_request = time.monotonic()


class WcsProvider:
    def __init__(self, product: str, root: Path, budget: Budget) -> None:
        self.product = product
        self.path, self.binding = MODELS[product]
        self.root = root / product
        self.root.mkdir(parents=True, exist_ok=True)
        self.budget = budget
        self.ids: list[str] = []
        self.receipts: dict[str, dict[str, Any]] = {}
        self.latest: dict[str, Any] = {}

    def request(
        self, operation: str, parameters: list[tuple[str, str]], limit: int
    ) -> bytes:
        url = (
            ORIGIN
            + self.path
            + operation
            + "?"
            + urlencode([("service", "WCS"), ("version", "2.0.1")] + parameters)
        )
        token = url + (
            datetime.now(UTC).strftime("%Y-%m-%dT%H")
            if operation == "GetCapabilities"
            else ""
        )
        key = hashlib.sha256(token.encode()).hexdigest()
        body_path, receipt_path = self.root / f"{key}.body", self.root / f"{key}.json"
        if body_path.exists():
            receipt = json.loads(receipt_path.read_text())
            body = body_path.read_bytes()
            if (
                receipt["url"] != url
                or receipt["sha256"] != hashlib.sha256(body).hexdigest()
            ):
                raise ValueError(
                    "Corrupt/incorrect WCS checkpoint; no automatic reacquisition"
                )
            self.receipts[key] = receipt
            self.latest = receipt
            return body
        self.budget.before()
        record, body = fetch(url, self.binding, limit)
        size = record.get("wire_bytes_read", 0)
        if not isinstance(size, int):
            raise TypeError("Invalid transport byte counter")
        self.budget.bytes += size
        if self.budget.bytes > self.budget.bytes_limit:
            raise RuntimeError("Source byte budget exceeded")
        if record["status"] != 200 or not body or record.get("outcome") != "received":
            atomic_write(self.root / f"{key}.failure.json", json.dumps(record).encode())
            raise RuntimeError(
                f"WCS {self.product}/{operation}: HTTP {record['status']}, {record.get('outcome', 'service_error')}"
            )
        receipt = {
            **record,
            "sha256": hashlib.sha256(body).hexdigest(),
            "acquired_at": datetime.now(UTC).isoformat(),
        }
        atomic_write(body_path, body)
        atomic_write(receipt_path, json.dumps(receipt, sort_keys=True).encode())
        self.receipts[key] = receipt
        self.latest = receipt
        return body

    def catalogue(self) -> list[str]:
        if not self.ids:
            self.ids = capabilities(
                self.request(
                    "GetCapabilities",
                    [("request", "GetCapabilities"), ("language", "eng")],
                    16 * 1024**2,
                )
            )
        return self.ids

    def coverage(self, variable: str, run: datetime) -> str:
        suffix = "_P1D" if variable == "precipitation" else ""
        value = f"{PARAMETERS[variable]}___{run:%Y-%m-%dT%H.%M.%SZ}{suffix}"
        if value not in self.catalogue():
            raise ValueError(
                f"Advertised {self.product} coverage absent: {variable}/{run.isoformat()}"
            )
        return value

    def description(self, coverage: str) -> bytes:
        return self.request(
            "DescribeCoverage", [("coverageID", coverage)], 16 * 1024**2
        )

    def field(
        self,
        coverage: str,
        valid_at: datetime | None,
        bounds: tuple[float, float, float, float],
        limit: int = 2 * 1024**2,
    ) -> bytes:
        description = self.description(coverage)
        root = xml_root(description)
        native = next(e.text for e in root.iter() if e.tag.endswith("}nativeFormat"))
        if native != "application/wmo-grib":
            raise ValueError("Only advertised native GRIB is acquired")
        subsets, _ = field_parameters(description, bounds, valid_at)
        return self.request(
            "GetCoverage",
            [("coverageid", coverage), ("format", native)] + subsets,
            limit,
        )


def grib_metadata(
    raw: bytes,
) -> tuple[dict[str, Any], list[tuple[float, float, float | None]]]:
    """Read exactly one native field; consumers validate expected run/interval/unit."""
    import eccodes as ec  # type: ignore[import-untyped]

    handle = ec.codes_new_from_message(raw)
    try:
        if (
            raw[:4] != b"GRIB"
            or int.from_bytes(raw[8:16], "big") != len(raw)
            or raw[-4:] != b"7777"
        ):
            raise ValueError("Exactly one complete GRIB field required")
        keys = [
            "edition",
            "shortName",
            "units",
            "typeOfLevel",
            "level",
            "dataDate",
            "dataTime",
            "validityDate",
            "validityTime",
            "startStep",
            "endStep",
            "stepType",
            "stepUnits",
            "typeOfGeneratingProcess",
            "gridType",
            "numberOfDataPoints",
            "iDirectionIncrementInDegrees",
            "jDirectionIncrementInDegrees",
            "bitsPerValue",
        ]
        meta = {key: ec.codes_get(handle, key) for key in keys}
        if meta["edition"] != 2 or meta["gridType"] != "regular_ll":
            raise ValueError("Verified regular GRIB2 grid required")
        missing = ec.codes_get(handle, "missingValue")
        coords = zip(
            *(
                ec.codes_get_array(handle, k)
                for k in ["latitudes", "longitudes", "values"]
            ),
            strict=True,
        )
        values = [
            (
                float(lat),
                (float(lon) + 180) % 360 - 180,
                None if v == missing or not math.isfinite(v) else float(v),
            )
            for lat, lon, v in coords
        ]
        return meta, values
    finally:
        ec.codes_release(handle)


def preflight(root: Path, run: datetime, budget: Budget) -> dict[str, Any]:
    report: dict[str, Any] = {
        "run": run.isoformat(),
        "samples": [],
        "budget": {
            "source_bytes": budget.bytes_limit,
            "requests": budget.requests_limit,
            "seconds": budget.seconds_limit,
        },
    }
    for model in MODELS:
        provider = WcsProvider(model, root, budget)
        for variable in PARAMETERS:
            coverage = provider.coverage(variable, run)
            raw = provider.field(coverage, None, (1.4, 48.0, 1.5, 48.1), 256 * 1024)
            meta, values = grib_metadata(raw)
            valid = [v for _, _, v in values if v is not None]
            report["samples"].append(
                {
                    "model": model,
                    "variable": variable,
                    "coverage": coverage,
                    "bytes": len(raw),
                    "grib": meta,
                    "minimum": min(valid) if valid else None,
                    "maximum": max(valid) if valid else None,
                    "sha256": hashlib.sha256(raw).hexdigest(),
                }
            )
            expected = 0.025 if model == "arome" else 0.1
            if (
                abs(meta["iDirectionIncrementInDegrees"] - expected) > 1e-8
                or abs(meta["jDirectionIncrementInDegrees"] - expected) > 1e-8
            ):
                raise ValueError("Wrong source grid")
            if variable == "precipitation":
                if (
                    meta["stepType"] != "accum"
                    or meta["endStep"] - meta["startStep"] != 24
                    or meta["units"] not in {"kg m**-2", "mm", "m"}
                ):
                    raise ValueError(
                        "P1D does not establish a complete daily precipitation interval"
                    )
            elif variable == "temperature" and (
                meta["units"] != "K" or meta["level"] != 2
            ):
                raise ValueError("Temperature level/units invalid")
            elif variable == "humidity" and (
                meta["units"] != "%" or meta["level"] != 2
            ):
                raise ValueError("Humidity level/units invalid")
    # Conservative uncompressed 32-bit packing, source-grid bounds, not 713 times the sample.
    aro_points = sum(
        (round((e - w) / 0.025) + 1) * (round((n - s) / 0.025) + 1)
        for w, s, e, n in TILES
    )
    arp_points = (round((BBOX[2] - BBOX[0]) / 0.1) + 1) * (
        round((BBOX[3] - BBOX[1]) / 0.1) + 1
    )
    # Three AROME days (recent/current/next), four ARPEGE days, 18 sampled T/RH +1 daily rain each.
    aro_bytes = 3 * 19 * (aro_points * 4 + 512 * 2)
    arp_bytes = 4 * 19 * (arp_points * 4 + 512)
    forecast_bytes = 66_259_061
    report["national_estimate"] = {
        "arome_points": aro_points,
        "arpege_points": arp_points,
        "wcs_bytes_upper_32bit": aro_bytes + arp_bytes,
        "ifs_measured_baseline_bytes": forecast_bytes,
        "total_source_bytes_estimate": aro_bytes + arp_bytes + forecast_bytes,
        "requests_estimate": 3 * 19 * 2 + 4 * 19 + 227 + 16,
        "admissible": aro_bytes + arp_bytes + forecast_bytes < budget.bytes_limit
        and 3 * 19 * 2 + 4 * 19 + 227 + 16 < budget.requests_limit,
    }
    report["actual"] = {
        "requests": budget.requests,
        "wire_body_bytes": budget.bytes,
        "seconds": time.monotonic() - budget.started,
    }
    atomic_write(
        root / "preflight.json", json.dumps(report, indent=2, sort_keys=True).encode()
    )
    return report
