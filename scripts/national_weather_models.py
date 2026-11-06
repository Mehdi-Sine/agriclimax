"""National WCS source reductions, shared field cache and independent numerical acceptance."""

import gzip
import hashlib
import json
from dataclasses import asdict
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

from agriclimax.ingestion.storage import atomic_write
from agriclimax.territories.national_daily import REFERENCE
from agriclimax.territories.national_weather import (
    GRID_VERSIONS,
    RULE,
    aggregate_day,
    reduce_native_day,
)
from agriclimax.territories.operational import regular_grid_weights
from agriclimax.territories.pipeline import digest
from agriclimax.territories.spatial import Territory, Weight, load_reference
from national_weather_sources import BBOX, TILES, Budget, WcsProvider, grib_metadata
from verify_national_weather import verify_day


def reference() -> tuple[list[Territory], str]:
    path = Path("config/coverage") / REFERENCE / "reference.json"
    raw = path.read_bytes()
    territories, _ = load_reference(json.loads(raw), version=REFERENCE)
    if len({t.id for t in territories}) != 713:
        raise ValueError("Official national identities mismatch")
    return territories, hashlib.sha256(raw).hexdigest()


def weights_for(
    model: str, territories: list[Territory], reference_sha: str, root: Path
) -> list[Weight]:
    path = root / f"weights-{model}.json.gz"
    if path.exists():
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != path.with_suffix(".sha256").read_text():
            raise ValueError("Corrupt model weights checkpoint")
        saved = json.loads(gzip.decompress(raw))
        if (
            saved["reference_sha256"] != reference_sha
            or saved["grid"] != GRID_VERSIONS[model]
        ):
            raise ValueError("Wrong grid/reference for weights")
        return [Weight(**w) for w in saved["weights"]]
    weights = regular_grid_weights(
        territories, 0.025 if model == "arome" else 0.1, model
    )
    raw = gzip.compress(
        json.dumps(
            {
                "grid": GRID_VERSIONS[model],
                "reference_sha256": reference_sha,
                "weights": [asdict(w) for w in weights],
            },
            sort_keys=True,
        ).encode(),
        mtime=0,
    )
    atomic_write(path, raw)
    atomic_write(path.with_suffix(".sha256"), hashlib.sha256(raw).hexdigest().encode())
    return weights


def native_field(
    provider: WcsProvider, variable: str, run: datetime, at: datetime, cells: set[str]
) -> tuple[dict[str, float | None], dict[str, Any], list[dict[str, Any]]]:
    spacing = 0.025 if provider.product == "arome" else 0.1
    tiles = TILES if provider.product == "arome" else (BBOX,)
    result: dict[str, float | None] = {}
    receipts = []
    last_meta = {}
    coverage = provider.coverage(variable, run)
    for tile_index, bounds in enumerate(tiles):
        raw = provider.field(coverage, at, bounds)
        meta, values = grib_metadata(raw)
        last_meta = meta
        original = datetime.strptime(
            f"{meta['dataDate']}{meta['dataTime']:04d}", "%Y%m%d%H%M"
        ).replace(tzinfo=UTC)
        validity = datetime.strptime(
            f"{meta['validityDate']}{meta['validityTime']:04d}", "%Y%m%d%H%M"
        ).replace(tzinfo=UTC)
        if (
            original != run
            or validity != at
            or meta["typeOfGeneratingProcess"] != 2
            or meta["stepUnits"] != 1
        ):
            raise ValueError(
                "Native source run/validity/generation type does not match requested forecast"
            )
        if (
            abs(meta["iDirectionIncrementInDegrees"] - spacing) > 1e-8
            or abs(meta["jDirectionIncrementInDegrees"] - spacing) > 1e-8
        ):
            raise ValueError("Incorrect WCS native grid")
        if variable == "precipitation":
            if (
                meta["shortName"] != "tp"
                or meta["stepType"] != "accum"
                or meta["endStep"] - meta["startStep"] != 24
                or meta["endStep"] != int((at - run).total_seconds() / 3600)
                or meta["units"] not in {"kg m**-2", "mm", "m"}
            ):
                raise ValueError("P1D precipitation interval or unit mismatch")
        elif (
            meta["level"] != 2
            or meta["typeOfLevel"] != "heightAboveGround"
            or meta["shortName"]
            not in ({"2t"} if variable == "temperature" else {"2r", "r"})
            or meta["units"] != ("K" if variable == "temperature" else "%")
        ):
            raise ValueError("Unexpected native variable, level or unit")
        for lat, lon, value in values:
            key = f"{provider.product}.{lat:.3f}.{lon:.3f}"
            if key in cells:
                # Deterministic native-node ownership, independent of PRA and request order.
                if any(
                    w - 1e-9 <= lon <= e + 1e-9 and s - 1e-9 <= lat <= n + 1e-9
                    for w, s, e, n in tiles[:tile_index]
                ):
                    continue
                if key in result and result[key] != value:
                    raise ValueError("Duplicate native node in one source tile")
                result[key] = value
        receipt = provider.latest
        receipts.append({k: receipt[k] for k in ["url", "sha256", "acquired_at"]})
    if set(result) != cells:
        raise ValueError(
            f"Native WCS grid does not cover {len(cells - set(result))} required cells"
        )
    return result, last_meta, receipts


def model_day(
    provider: WcsProvider,
    run: datetime,
    day: date,
    territories: list[Territory],
    weights: list[Weight],
    root: Path,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    directory = root / "reduced"
    directory.mkdir(exist_ok=True)
    path = directory / f"{provider.product}-{day}.json.gz"
    fingerprint = digest([asdict(w) for w in weights])
    if path.exists():
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != path.with_suffix(".sha256").read_text():
            raise ValueError("Corrupt reduced weather checkpoint")
        saved = json.loads(gzip.decompress(raw))
        if (
            saved["weights"] != fingerprint
            or saved["run"] != run.isoformat()
            or saved["method"] != RULE
        ):
            raise ValueError("Reduced checkpoint source/version conflict")
        return saved["rows"], saved["audit"]
    cells = {w.cell_id for w in weights}
    start = datetime.combine(day, datetime.min.time(), UTC)
    step0 = int((start - run).total_seconds() / 3600)
    steps = list(range(step0, step0 + 25, 3))
    temperatures = []
    humidities = []
    receipts = []
    for step in steps:
        at = run + timedelta(hours=step)
        temp, _, rs = native_field(provider, "temperature", run, at, cells)
        temperatures.append(temp)
        receipts.extend(rs)
        rh, _, rs = native_field(provider, "humidity", run, at, cells)
        humidities.append(rh)
        receipts.extend(rs)
    rain, meta, rs = native_field(
        provider, "precipitation", run, start + timedelta(days=1), cells
    )
    receipts.extend(rs)
    factor = 1000.0 if meta["units"] == "m" else 1.0
    values, temporal, anomalies = reduce_native_day(
        temperatures, humidities, rain, steps, factor
    )
    provenance = digest(receipts)
    acquired = max(datetime.fromisoformat(r["acquired_at"]) for r in receipts)
    rows = aggregate_day(
        territories,
        weights,
        provider.product,
        run,
        day,
        values,
        temporal,
        provenance,
        acquired,
        day < datetime.now(UTC).date(),
    )
    audit = {
        "model": provider.product,
        "date": str(day),
        "run": run.isoformat(),
        "native_cells": len(cells),
        "anomalies": anomalies,
        "independent": verify_day(
            rows, weights, temperatures, humidities, rain, factor
        ),
        "source_receipts": receipts,
    }
    raw = gzip.compress(
        json.dumps(
            {
                "rows": rows,
                "audit": audit,
                "run": run.isoformat(),
                "weights": fingerprint,
                "method": RULE,
            },
            sort_keys=True,
            allow_nan=False,
        ).encode(),
        mtime=0,
    )
    atomic_write(path, raw)
    atomic_write(path.with_suffix(".sha256"), hashlib.sha256(raw).hexdigest().encode())
    if sum(p.stat().st_size for p in root.rglob("*") if p.is_file()) > 448 * 1024**2:
        raise RuntimeError("Weather checkpoint workspace budget exceeded")
    return rows, audit


def wcs_models(
    root: Path, run: datetime, budget: Budget
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, list[Weight]]]:
    territories, reference_sha = reference()
    rows = []
    audits = []
    all_weights = {}
    for model in ["arome", "arpege"]:
        weights = weights_for(model, territories, reference_sha, root)
        all_weights[model] = weights
        provider = WcsProvider(model, root, budget)
        for offset in [-1, 0, 1] if model == "arome" else [0, 1, 2, 3]:
            day = run.date() + timedelta(days=offset)
            source_run = run - timedelta(days=1) if offset == -1 else run
            output, audit = model_day(
                provider, source_run, day, territories, weights, root
            )
            rows.extend(output)
            audits.append(audit)
            atomic_write(
                root / "progress.json",
                json.dumps(
                    {
                        "completed_model_days": [
                            {"model": a["model"], "date": a["date"]} for a in audits
                        ],
                        "source_requests": budget.requests,
                        "source_bytes": budget.bytes,
                    }
                ).encode(),
            )
    return rows, audits, all_weights
