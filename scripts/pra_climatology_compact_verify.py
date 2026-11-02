"""Verify actual compact normal reads against immutable Task21 and daily NULL semantics."""

from __future__ import annotations

import json
import time
from datetime import date

import numpy as np
from pra_climatology import document
from pra_climatology_compact import EVIDENCE, ROOT
from pra_climatology_store import rpc


def verify() -> None:
    release = json.loads((EVIDENCE / "release.json").read_text())["version"]
    with np.load(ROOT / "normal-cache.npz", allow_pickle=False) as cache:
        normal = cache["normal"].copy()
        counts = cache["sample_years"].copy()
        ids = cache["ids"].tolist()
    exported = json.loads((ROOT / "task21-export.json").read_text())[0]["payload"]
    index = {p: i for i, p in enumerate(ids)}
    for pra, period, variable, value, n in exported["rows"]:
        di = date.fromisoformat("2000-" + period).timetuple().tm_yday - 1
        actual = normal[di, index[pra], variable]
        if (
            (value is None and np.isfinite(actual))
            or (value is not None and actual != np.float32(value))
            or counts[di, index[pra], variable] != n
        ):
            raise ValueError("Task21 published normal/count changed")
    examples = []
    checked = 0
    for pra in ["pra:28341", "pra:06245", "pra:29102"]:
        for start, end in [
            ("2026-09-19", "2026-10-18"),
            ("2024-02-29", "2024-03-01"),
            ("2026-01-01", "2026-01-01"),
        ]:
            mark = time.monotonic()
            response = rpc(
                "agriclimax_pra_climatology_daily_read",
                {
                    "p_release": release,
                    "p_dataset": "era5land-national-20260919-20261018-v1",
                    "p_pra": pra,
                    "p_start": start,
                    "p_end": end,
                },
            )
            if (
                response["reference_period"] != [1991, 2020]
                or response["source_kind"] != "reanalysis"
            ):
                raise ValueError("Wrong reference/source kind")
            order = {
                "temperature_min": 0,
                "temperature_max": 1,
                "temperature": 2,
                "precipitation": 3,
            }
            for row in response["data"]:
                d = date.fromisoformat(row["date"])
                di = date(2000, d.month, d.day).timetuple().tm_yday - 1
                v = order[row["variable"]]
                expected = normal[di, index[pra], v]
                value = row["normal_1991_2020"]
                if (value is None) != (not np.isfinite(expected)):
                    raise ValueError("Normal NULL changed in API")
                if value is not None and np.float32(value) != expected:
                    raise ValueError("Normal changed in API")
                if row["sample_years"] != counts[di, index[pra], v]:
                    raise ValueError("Count changed in API")
                current, anomaly = row["current_value"], row["anomaly"]
                if current is None or value is None:
                    if anomaly is not None:
                        raise ValueError("Missing current/reference became an anomaly")
                elif not np.isclose(
                    anomaly,
                    float(np.float32(current)) - float(np.float32(value)),
                    rtol=0,
                    atol=1e-12,
                ):
                    # Reconstruct stored binary float32 from PostgreSQL's roundtrip-safe JSON.
                    raise ValueError("API anomaly is not current minus normal")
                if "current_coverage" not in row or "current_quality_flags" not in row:
                    raise ValueError("Quality/coverage missing")
                checked += 1
            examples.append(
                {
                    "pra_id": pra,
                    "start": start,
                    "end": end,
                    "milliseconds": (time.monotonic() - mark) * 1000,
                    "response": response,
                }
            )
    document(
        EVIDENCE / "api-validation.json",
        {
            "status": "passed",
            "scalars_checked": checked,
            "task21_scalars_reused_exactly": len(exported["rows"]),
            "examples": examples,
        },
    )
    print("PASS: real server reads, NULLs, leap day, coverage, Task21 reuse", checked)


if __name__ == "__main__":
    verify()
