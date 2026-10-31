"""Resume the fixed 73-PRA historical pilot with at most four CDS jobs.

Only job IDs, fixed request parameters, checksums and safe error codes are written.
No credential values, signed download URLs or upstream error bodies are retained.
"""

from __future__ import annotations

import concurrent.futures
import json
import logging
import os
import threading
import time
from datetime import UTC, datetime
from pathlib import Path

from ecmwf.datastores import Client
from ecmwf.datastores.processing import LinkError
from pra_climatology import ROOT, SOURCE_LIMIT, checksum, document, identity, requests
from requests import RequestException

logging.disable(logging.CRITICAL)
DOWNLOAD_LOCK = threading.Lock()


def one(
    request: dict[str, object], *, root: Path = ROOT, limit: int = SOURCE_LIMIT
) -> None:
    target = root / "sources" / (identity(request) + ".nc")
    receipt = target.with_suffix(".json")
    jobfile = target.with_suffix(".job.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    if receipt.exists():
        saved = json.loads(receipt.read_text())
        if saved["request"] != request or saved["sha256"] != checksum(target):
            raise ValueError("Immutable source checksum/request mismatch")
        return
    mark = time.monotonic()
    client = Client(
        url="https://cds.climate.copernicus.eu/api",
        key=os.environ["CDSAPI_KEY"],
        timeout=60,
        maximum_tries=3,
        retry_after=8,
        progress=False,
        sleep_max=30,
    )
    try:
        if jobfile.exists():
            job = json.loads(jobfile.read_text())
            if job["request"] != request:
                raise ValueError("Job request identity mismatch")
            remote = client.get_remote(job["job_id"])
        else:
            remote = client.submit("reanalysis-era5-land", request)
            document(
                jobfile,
                {
                    "request": request,
                    "job_id": remote.request_id,
                    "created_at": time.time(),
                },
            )
        job_created_at = json.loads(jobfile.read_text())["created_at"]
        while True:
            status = remote.status
            document(
                target.with_suffix(".status.json"),
                {
                    "status": status,
                    "elapsed_seconds": time.monotonic() - mark,
                    "job_elapsed_seconds": time.time() - job_created_at,
                },
            )
            if status in ("failed", "rejected", "dismissed", "deleted"):
                raise RuntimeError("CDS terminal status " + status)
            if status == "successful":
                break
            time.sleep(30)
        with DOWNLOAD_LOCK:
            results = remote.get_results()
            if (
                sum(p.stat().st_size for p in (root / "sources").glob("*.nc"))
                + results.content_length
                > limit
            ):
                raise RuntimeError("Source storage budget exceeded")
            partial = target.with_suffix(".partial")
            results.download(str(partial))
            partial.replace(target)
        document(
            receipt,
            {
                "request": request,
                "job_id": remote.request_id,
                "sha256": checksum(target),
                "bytes": target.stat().st_size,
                "seconds": time.time() - job_created_at,
                "session_seconds": time.monotonic() - mark,
                "retrieved_at": datetime.now(UTC).isoformat(),
            },
        )
        print("downloaded", request["year"], request["month"], flush=True)
    except (OSError, ValueError, RuntimeError, RequestException, LinkError) as e:
        failure = {
            "status": "failed",
            "error_type": type(e).__name__,
            "request": request,
            "elapsed_seconds": time.monotonic() - mark,
        }
        if hasattr(e, "response") and e.response is not None:
            failure["http_status"] = e.response.status_code
        document(target.with_suffix(".failure.json"), failure)
        print(json.dumps(failure), flush=True)
        raise RuntimeError("Acquisition stopped; see safe failure receipt") from None


def main() -> None:
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(one, requests()))


if __name__ == "__main__":
    main()
