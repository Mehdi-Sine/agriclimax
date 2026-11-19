"""Project the already-written SIM receipts into the private editorial diagnostics."""
from __future__ import annotations

import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from task36_nightly import rpc


def receipt(name: str) -> dict[str, Any]:
    path = Path("work/couv04/receipts") / f"{name}.json"
    if not path.is_file() or path.stat().st_size == 0:
        return {}
    return dict(json.loads(path.read_text()))


def record() -> None:
    today = datetime.now(ZoneInfo("Europe/Paris")).date().isoformat()
    if os.environ.get("AGRICLIMAX_EDITION_DATE") != today:
        return
    collect, save, readback = (receipt(name) for name in ("collect", "save", "readback"))
    verified = (readback.get("status") == "restored" and save.get("sha256") is not None
                and save["sha256"] == readback.get("sha256"))
    state = "retryable_failure"
    if verified:
        state = "degraded" if collect.get("missing_dates") else "success"
    run = os.environ.get("GITHUB_RUN_ID", str(time.time_ns()))
    attempt = os.environ.get("GITHUB_RUN_ATTEMPT", "1")
    rpc("diagnostic", {"edition_date": today, "id": f"sim-admin-{today}-{run}-{attempt}",
        "body": {"state": state, "latest": collect.get("source_last"), "persisted": verified,
                 "elapsed_seconds": float(collect["total_seconds"]) if "total_seconds" in collect else None}})


if __name__ == "__main__":
    try:
        record()
    except Exception:  # noqa: BLE001 - avoid logging provider payloads or credentials
        raise SystemExit("SIM_ADMIN_DIAGNOSTIC_FAILED") from None
