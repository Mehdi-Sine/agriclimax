"""Read-only measurements against the local production-build API backed by DEV."""

from __future__ import annotations

import argparse
import json
import statistics
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import ProxyHandler, build_opener

import numpy as np
from pra_30day_review import LAST, OLD_EDITION, OLD_ROOT, composite, read_outputs
from pra_30day_run import EDITION, END, ROOT, SAMPLE, START


def float4_matches(actual: float, expected: float) -> bool:
    """Accept float4 shortest output or PostgreSQL extra_float_digits=0 (six significant digits)."""
    stored = float(np.float32(expected))
    return (
        actual == float(format(stored, ".6g"))
        or abs(actual - stored) <= float(np.spacing(np.float32(abs(stored)))) / 2
    )


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--port", type=int, default=3000)
    p.add_argument("--output", type=Path, default=Path("work/task19c/http.json"))
    a = p.parse_args()
    if not 1024 <= a.port <= 65535:
        p.error("Local unprivileged port required")
    base = f"http://127.0.0.1:{a.port}"
    opener = build_opener(ProxyHandler({}))
    sample = json.loads(SAMPLE.read_text())
    ids = {r["id"] for r in sample["selection"]}
    reference = sample["reference_version"]
    old, new = read_outputs(OLD_ROOT, "supabase"), read_outputs(ROOT, "supabase")
    composition = composite(old, new)
    expected = {
        (o["identity"]["pra"], r["valid_date"]): (r, o["batch_key"], o["computed_at"])
        for o in old + new
        for r in o["daily"]
    }
    counters = {
        "http_requests": 0,
        "downloaded_json_bytes": 0,
        "scalar_comparisons": 0,
        "maximum_scalar_roundtrip_error": 0.0,
    }

    def get(endpoint: str, params: dict[str, str]) -> tuple[dict[str, Any], int]:
        with opener.open(
            base + endpoint + "?" + urlencode(params), timeout=30
        ) as response:
            payload = response.read()
            status = response.status
        if status != 200:
            raise ValueError("HTTP selection unavailable")
        counters["http_requests"] += 1
        counters["downloaded_json_bytes"] += len(payload)
        return json.loads(payload), len(payload)

    def selection(
        day: str, limit: int, single: bool = False
    ) -> tuple[list[dict[str, Any]], int, int]:
        edition = EDITION if day <= str(END) else OLD_EDITION
        params = {
            "action": "read",
            "reference": reference,
            "dataset": edition,
            "date": day,
            "scope": "pra" if single else "france",
            "limit": "1" if single else "100",
        }
        if single:
            params["id"] = "pra:28341"
        rows: list[dict[str, Any]] = []
        requests = 0
        size = 0
        while True:
            data, nbytes = get("/api/territories", params)
            requests += 1
            size += nbytes
            if (
                data["source_id"] != "era5-land"
                or data["source_kind"] != "reanalysis"
                or data["dataset_version"] != edition
            ):
                raise ValueError("Incorrect source/version in actual HTTP response")
            rows.extend(r for r in data["data"] if r["id"] in ids)
            if len(rows) >= limit or not data["next_cursor"]:
                break
            params["after"] = data["next_cursor"]
        rows = rows[:limit]
        if len(rows) != limit or len({r["id"] for r in rows}) != limit:
            raise ValueError("Incomplete/duplicate HTTP selection")
        for row in rows:
            e, key, computed = expected[row["id"], day]
            if (
                row["valid_counts"] != e["valid_counts"]
                or row["expected_cells"] != e["expected_cells"]
                or row["batch_key"] != key
                or row["freshness"] != "stale"
                or row["quality_flags"] != e["quality_flags"]
                or datetime.fromisoformat(row["computed_at"])
                != datetime.fromisoformat(computed)
            ):
                raise ValueError("HTTP support, provenance or freshness mismatch")
            state = (
                "unavailable" if all(v == 0 for v in e["valid_counts"]) else e["status"]
            )
            if row["status"] != state:
                raise ValueError("Incorrect explicit availability")
            for i, var in enumerate(
                ["temperature", "temperature_min", "temperature_max", "precipitation"]
            ):
                if abs(row["coverage"][i] - e["coverage"][i]) > 1e-6:
                    raise ValueError("Incorrect weighted coverage")
                if e[var] is None:
                    if row[var] is not None:
                        raise ValueError("NULL replaced with fabricated value")
                else:
                    error = abs(row[var] - e[var])
                    counters["maximum_scalar_roundtrip_error"] = max(
                        error, counters["maximum_scalar_roundtrip_error"]
                    )
                    if not float4_matches(row[var], e[var]):
                        raise ValueError(
                            "HTTP scalar differs from real computed output"
                        )
                counters["scalar_comparisons"] += 1
        return rows, requests, size

    timings = []
    for count in [1, 10, 73]:
        samples = []
        requests = 0
        size = 0
        for _ in range(3):
            mark = time.monotonic()
            rows, requests, size = selection("2026-09-30", count, single=count == 1)
            samples.append(1000 * (time.monotonic() - mark))
        timings.append(
            {
                "pra": count,
                "date": "2026-09-30",
                "milliseconds": samples,
                "median_ms": statistics.median(samples),
                "http_pages": requests,
                "downloaded_bytes": size,
                "selected_json_bytes": len(json.dumps(rows).encode()),
            }
        )
    # Actual endpoint map path, all 73 selected PRA on all 30 dates; no synthetic data.
    mark = time.monotonic()
    all_dates = []
    for n in range(30):
        day = str(START + timedelta(days=n))
        rows, _, _ = selection(day, 73)
        if {r["id"] for r in rows} != ids:
            raise ValueError("Map selection differs from sample")
        all_dates.extend(rows)
    map_history_seconds = time.monotonic() - mark
    history = []
    for _ in range(3):
        mark = time.monotonic()
        records = []
        for n in range(30):
            records.extend(selection(str(START + timedelta(days=n)), 1, single=True)[0])
        history.append(1000 * (time.monotonic() - mark))
    if len({r["valid_date"] for r in records}) != 30:
        raise ValueError("Discontinuous actual history")
    parameters = old[0]["diagnostics"][0]["parameters_sha256"]
    mark = time.monotonic()
    diagnostics, size = get(
        "/api/territories/diagnostics",
        {
            "reference": reference,
            "dataset": EDITION,
            "pra": "pra:28341",
            "start": str(START),
            "end": str(LAST),
            "parameters": parameters,
        },
    )
    if diagnostics["data"] or diagnostics["risk_computed"]:
        raise ValueError("Unexpected persisted systematic diagnostics")
    result = {
        "source": "local production-build API / remote DEV, real data",
        "read": timings,
        "map_endpoint": "/api/territories?action=read&scope=france (existing pagination; selection filtered explicitly)",
        "map_30_dates": {"seconds": map_history_seconds, "pra_days": len(all_dates)},
        "one_pra_30day_history": {
            "milliseconds": history,
            "median_ms": statistics.median(history),
            "json_bytes": len(json.dumps(records).encode()),
            "http_requests_per_sample": 30,
        },
        "diagnostics_sparse_read": {
            "milliseconds": 1000 * (time.monotonic() - mark),
            "bytes": size,
            "rows": 0,
            "computed": False,
            "note": "On-demand computation measured separately from verified native cache; no new persisted diagnostics",
        },
        "components": composition["component_editions"],
        "checks": counters,
        "scalar_check": "float4 shortest or six significant digit PostgreSQL JSON; exact NULL/counts",
    }
    a.output.parent.mkdir(parents=True, exist_ok=True)
    a.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
