"""National real-output inventory and read-only HTTP validation/performance."""

from __future__ import annotations

import argparse
import json
import statistics
import time
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import ProxyHandler, build_opener

from pra_30day_http import float4_matches
from pra_30day_run import BUNDLE, START
from pra_national_30day import LAST, NATIONAL_EDITION, ROOT

VARIABLES = ("temperature", "temperature_min", "temperature_max", "precipitation")


def state(row: dict[str, Any]) -> str:
    return (
        "unavailable"
        if all(n == 0 for n in row["valid_counts"])
        else "complete"
        if row["status"] == "available"
        else "partial"
    )


def outputs(destination: str) -> list[dict[str, Any]]:
    return [
        o
        for f in sorted(ROOT.glob("batches/*/output.json"))
        if (o := json.loads(f.read_text()))["identity"]["destination"] == destination
    ]


def inventory(batches: list[dict[str, Any]]) -> dict[str, Any]:
    ids = {
        "pra:" + f["properties"]["code"]
        for f in json.loads((BUNDLE / "reference.json").read_text())["features"]
    }
    if len(batches) != 3565 or len(ids) != 713:
        raise ValueError("Exactly 3565 national batches required")
    rows: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for batch in batches:
        if (
            batch["identity"]["dataset"]["dataset_version"] != NATIONAL_EDITION
            or batch["diagnostics"]
            or batch["identity"]["parameters"] is not None
        ):
            raise ValueError("Wrong release or systematic diagnostics")
        for row in batch["daily"]:
            if row["pra_id"] != batch["identity"]["pra"]:
                raise ValueError("PRA identity mismatch")
            for i, var in enumerate(VARIABLES):
                if (
                    row["valid_counts"][i] < row["expected_cells"]
                    and row[var] is not None
                ):
                    raise ValueError("Incomplete full-PRA value fabricated")
            rows[row["pra_id"]].append(row)
    dates = {str(START + timedelta(days=i)) for i in range(30)}
    if set(rows) != ids:
        raise ValueError("Missing national PRA")
    details = []
    for pid, items in sorted(rows.items()):
        if len(items) != 30 or {r["valid_date"] for r in items} != dates:
            raise ValueError("Duplicate or missing national date")
        counts = Counter(state(r) for r in items)
        period = (
            "complete"
            if counts["complete"] == 30
            else "unavailable"
            if counts["unavailable"] == 30
            else "partial"
        )
        expected = {r["expected_cells"] for r in items}
        if len(expected) != 1:
            raise ValueError("Support changed across windows")
        details.append(
            {
                "pra": pid,
                "state": period,
                "day_states": dict(counts),
                "expected_cells": next(iter(expected)),
                "minimum_valid_counts": [
                    min(r["valid_counts"][i] for r in items) for i in range(4)
                ],
                "maximum_valid_counts": [
                    max(r["valid_counts"][i] for r in items) for i in range(4)
                ],
                "minimum_coverage": [
                    min(r["coverage"][i] for r in items) for i in range(4)
                ],
                "null_scalar_count": sum(
                    r[v] is None for r in items for v in VARIABLES
                ),
            }
        )
    return {
        "dataset": NATIONAL_EDITION,
        "period_utc": [str(START), str(LAST)],
        "pra": 713,
        "pra_days": 21390,
        "batches": 3565,
        "pra_states": dict(Counter(r["state"] for r in details)),
        "day_states": dict(Counter(state(r) for items in rows.values() for r in items)),
        "availability": details,
        "structural_mask": "not certified; observed availability only",
        "systematic_diagnostics": 0,
    }


def http_measure(batches: list[dict[str, Any]], port: int) -> dict[str, Any]:
    opener = build_opener(ProxyHandler({}))
    base = f"http://127.0.0.1:{port}/api/territories?"
    reference = json.loads((BUNDLE / "manifest.json").read_text())["reference_version"]
    expected = {
        (r["pra_id"], r["valid_date"]): (r, b["batch_key"], b["computed_at"])
        for b in batches
        for r in b["daily"]
    }
    comparisons = 0
    requests = 0
    total_bytes = 0
    maximum_error = 0.0

    def read(
        day: str, limit: int, single: bool = False
    ) -> tuple[list[dict[str, Any]], int, int]:
        nonlocal comparisons, requests, total_bytes, maximum_error
        params = {
            "action": "read",
            "reference": reference,
            "dataset": NATIONAL_EDITION,
            "date": day,
            "scope": "pra" if single else "france",
            "limit": str(min(limit, 100)),
        }
        if single:
            params["id"] = "pra:28341"
        rows = []
        pages = 0
        nbytes = 0
        while True:
            with opener.open(base + urlencode(params), timeout=30) as response:
                content = response.read()
                status = response.status
            if status != 200:
                raise ValueError("National HTTP unavailable")
            data = json.loads(content)
            pages += 1
            nbytes += len(content)
            requests += 1
            total_bytes += len(content)
            if (
                data["source_id"] != "era5-land"
                or data["dataset_version"] != NATIONAL_EDITION
            ):
                raise ValueError("Wrong HTTP source")
            rows.extend(data["data"])
            if len(rows) >= limit or not data["next_cursor"]:
                break
            params["after"] = data["next_cursor"]
        if len(rows) != limit or len({r["id"] for r in rows}) != limit:
            raise ValueError("National pagination missing/duplicate")
        for r in rows:
            e, key, computed = expected[r["id"], day]
            if (
                r["valid_counts"] != e["valid_counts"]
                or r["expected_cells"] != e["expected_cells"]
                or r["quality_flags"] != e["quality_flags"]
                or r["batch_key"] != key
                or datetime.fromisoformat(r["computed_at"])
                != datetime.fromisoformat(computed)
                or r["freshness"] != "stale"
            ):
                raise ValueError("HTTP counts/lineage/freshness mismatch")
            expected_state = "unavailable" if state(e) == "unavailable" else e["status"]
            if r["status"] != expected_state:
                raise ValueError("Incorrect HTTP availability")
            for i, var in enumerate(VARIABLES):
                if abs(r["coverage"][i] - e["coverage"][i]) > 1e-6:
                    raise ValueError("Coverage mismatch")
                if e[var] is None:
                    if r[var] is not None:
                        raise ValueError("NULL replaced")
                else:
                    if not float4_matches(r[var], e[var]):
                        raise ValueError("National value incorrect")
                    maximum_error = max(maximum_error, abs(r[var] - e[var]))
                comparisons += 1
        return rows, pages, nbytes

    performance = []
    for count in [1, 10, 713]:
        values = []
        for _ in range(3):
            mark = time.monotonic()
            rows, pages, size = read("2026-09-30", count, single=count == 1)
            values.append(1000 * (time.monotonic() - mark))
        performance.append(
            {
                "pra": count,
                "milliseconds": values,
                "median_ms": statistics.median(values),
                "http_pages": pages,
                "json_bytes": size,
            }
        )
    mark = time.monotonic()
    seen: set[tuple[str, str]] = set()
    for i in range(30):
        day = str(START + timedelta(days=i))
        rows, _, _ = read(day, 713)
        seen.update((r["id"], r["valid_date"]) for r in rows)
    if len(seen) != 21390:
        raise ValueError("National HTTP corpus incomplete")
    corpus_seconds = time.monotonic() - mark
    history = []
    for _ in range(3):
        mark = time.monotonic()
        for i in range(30):
            read(str(START + timedelta(days=i)), 1, single=True)
        history.append(1000 * (time.monotonic() - mark))
    return {
        "environment": "Local production-build HTTP -> remote DEV, real data",
        "read": performance,
        "corpus_pra_days": len(seen),
        "corpus_read_seconds": corpus_seconds,
        "one_pra_30day_history_ms": history,
        "history_median_ms": statistics.median(history),
        "http_requests": requests,
        "received_bytes": total_bytes,
        "scalar_comparisons": comparisons,
        "maximum_float4_roundtrip_error": maximum_error,
        "sla": False,
    }


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--destination", choices=["local", "supabase"], default="local")
    p.add_argument("--http", action="store_true")
    p.add_argument("--port", type=int, default=3000)
    p.add_argument(
        "--output", type=Path, default=Path("work/task19d/resume/inventory.json")
    )
    a = p.parse_args()
    if not 1024 <= a.port <= 65535:
        p.error("Local unprivileged port only")
    batches = outputs(a.destination)
    result = inventory(batches)
    if a.http:
        if a.destination != "supabase":
            p.error("HTTP comparison requires actual persisted outputs")
        result["http"] = http_measure(batches, a.port)
    a.output.parent.mkdir(parents=True, exist_ok=True)
    a.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({k: v for k, v in result.items() if k != "availability"}))


if __name__ == "__main__":
    main()
