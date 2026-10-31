"""Explicit DEV-only immutable PRA normal import; hourly sources never enter Postgres."""

from __future__ import annotations

import argparse
import json
import os
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener

from agriclimax.climate.pra_normals import VARIABLES
from agriclimax.ingestion.meteofrance import NoRedirect
from pra_climatology import ROOT, checksum, document, verify_bundle

DEV = "https://yyfbpecxvxglzxopsmel.supabase.co"


def rpc(name: str, body: dict[str, Any]) -> Any:
    if os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/") != DEV:
        raise ValueError("Only agriclimax-dev is eligible")
    data = json.dumps(body, allow_nan=False).encode()
    request = Request(
        DEV + "/rest/v1/rpc/" + name,
        data=data,
        headers={
            "apikey": os.environ["SUPABASE_SECRET_KEY"],
            "Content-Type": "application/json",
        },
    )
    for attempt in range(3):
        try:
            with build_opener(NoRedirect()).open(request, timeout=30) as response:
                return json.load(response)
        except HTTPError as error:
            if error.code not in {429, 502, 503, 504} or attempt == 2:
                raise RuntimeError(
                    f"Climatology RPC failed: HTTP {error.code}"
                ) from None
        except (URLError, TimeoutError, OSError):
            if attempt == 2:
                raise RuntimeError("Climatology RPC transport failed") from None
        time.sleep(attempt + 1)
    raise RuntimeError("Climatology RPC retry budget exceeded")


def release(provenance: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    metadata = {k: v for k, v in provenance.items() if not k.startswith("current_")}
    metadata.update(
        variable_order=list(VARIABLES),
        scientific_status="exploratory",
        precision="float32 SQL aggregates; float64 historical PRA cache outside Supabase",
        periods={
            "daily": "UTC",
            "09-19/10-18": {"days": 30, "temperature": "mean", "precipitation": "sum"},
        },
    )
    return "era5land-pra1991-2020-0919-1018-v1-" + metadata["source_manifest_sha256"][
        :16
    ], metadata


def persist(scope: str) -> None:
    verify_bundle()
    proof = json.loads((ROOT / f"{scope}-independent.json").read_text())
    path = ROOT / f"{scope}-normals.json"
    if proof["status"] != "passed" or proof["normal_sha256"] != checksum(path):
        raise ValueError("Independent complete validation required before persistence")
    payload = json.loads(path.read_text())
    version, meta = release(payload["provenance"])
    rows = [
        {
            k: r[k]
            for k in (
                "pra_id",
                "period_key",
                "normal",
                "p10",
                "median",
                "p90",
                "sample_years",
            )
        }
        | {"variable": VARIABLES.index(r["variable"])}
        for r in payload["data"]
    ]
    if len(rows) != proof["normal_rows"]:
        raise ValueError("Validated row count changed")
    batches = []
    mark = time.monotonic()
    for offset in range(0, len(rows), 1000):
        t = time.monotonic()
        changed = rpc(
            "agriclimax_persist_pra_climatology",
            {
                "p_release": version,
                "p_reference": meta["reference_version"],
                "p_provenance": meta,
                "p_rows": rows[offset : offset + 1000],
            },
        )
        if type(changed) is not int or not 0 <= changed <= len(
            rows[offset : offset + 1000]
        ):
            raise ValueError("Invalid persistence receipt")
        batches.append(
            {"offset": offset, "inserted": changed, "seconds": time.monotonic() - t}
        )
        document(
            ROOT / f"{scope}-import-progress.json",
            {"release": version, "batches": batches},
        )
    document(ROOT / "release.json", {"version": version, "provenance": meta})
    result = {
        "release": version,
        "scope": scope,
        "rows": len(rows),
        "inserted_receipts": sum(b["inserted"] for b in batches),
        "seconds": time.monotonic() - mark,
        "batches": batches,
        "source_sha256": proof["normal_sha256"],
    }
    document(ROOT / f"{scope}-import.json", result)
    print(json.dumps({k: v for k, v in result.items() if k != "batches"}))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scope", choices=["pilot", "national"], default="pilot")
    args = parser.parse_args()
    persist(args.scope)


if __name__ == "__main__":
    main()
