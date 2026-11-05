"""Read-only actual checkpoint/API/crop parity; no synthetic data or DB writes."""

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
from time import monotonic
from typing import Any
from urllib.parse import urlencode, urlsplit
from urllib.request import ProxyHandler, build_opener

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from pra_30day_http import float4_matches


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="http://127.0.0.1:3031")
    parser.add_argument("--date", required=True)
    parser.add_argument("--checkpoints", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    origin = urlsplit(args.base)
    if origin.scheme != "http" or origin.hostname != "127.0.0.1" or origin.username:
        parser.error("Only local build or TLS-verifying read-only Preview gateway")
    opener = build_opener(ProxyHandler({}))  # Loopback only, no credentials.

    def get(endpoint: str, **params: str) -> dict[str, Any]:
        with opener.open(
            args.base + endpoint + "?" + urlencode(params), timeout=120
        ) as response:
            payload = json.loads(response.read(2_000_001))
        if not isinstance(payload, dict):
            raise TypeError("Expected JSON object")
        return payload

    mark = monotonic()
    expected = {}
    for path in args.checkpoints.glob("batches/*/output.json"):
        envelope = json.loads(path.read_text())
        for row in envelope["daily"]:
            if row["valid_date"] == args.date:
                if row["pra_id"] in expected:
                    raise ValueError("Duplicate expected native checkpoint")
                expected[row["pra_id"]] = (row, envelope)
    assert len(expected) == 713, "Exactly 713 actual checkpoints required"
    catalog = get("/api/national", action="availability")
    assert catalog["latest"] >= args.date
    actual = get("/api/national", action="day", date=args.date)
    assert len(actual["data"]) == 713 == len({r["id"] for r in actual["data"]})
    variables = ("temperature", "temperature_min", "temperature_max", "precipitation")
    comparisons = 0
    for row in actual["data"]:
        original, envelope = expected[row["id"]]
        assert row["batch_key"] == envelope["batch_key"]
        assert row["valid_counts"] == original["valid_counts"]
        assert row["expected_cells"] == original["expected_cells"]
        for name in variables:
            wanted, value = original[name], row[name]
            assert (wanted is None and value is None) or (
                wanted is not None
                and value is not None
                and float4_matches(value, wanted)
            ), (row["id"], name)
            comparisons += 1
    by_id = {r["id"]: r for r in actual["data"]}
    unified_counts = {}
    for indicator, variable in (
        ("temperature", "temperature"),
        ("temperature_min", "temperature_min"),
        ("temperature_max", "temperature_max"),
        ("rain", "precipitation"),
    ):
        unified = get(
            "/api/unified", start=args.date, end=args.date, indicator=indicator
        )
        assert len(unified["data"]) == 713
        unified_counts[indicator] = len(unified["data"])
        for row in unified["data"]:
            value = by_id[row["territoryId"]][variable]
            assert (value is None and row["value"] is None) or (
                value is not None
                and row["value"] is not None
                and float4_matches(value, row["value"])
            )
            if row["status"] != "available":
                assert row["anomaly"] is None
    crops = []
    for identifier in ("rpg-group-1-surf-pra", "saa-cop-03-surf-departement"):
        path = Path("apps/web/data/agriculture") / f"{identifier}.json"
        protected = json.loads(path.read_text())
        remote = get("/api/agriculture", action="dataset", indicator=identifier)
        float64_transport_adjustments = 0

        def compare(original: Any, served: Any) -> None:
            nonlocal float64_transport_adjustments
            if original == served:
                return
            if isinstance(original, dict) and isinstance(served, dict):
                for key, value in original.items():
                    assert key in served
                    compare(value, served[key])
            elif isinstance(original, list) and isinstance(served, list):
                assert len(original) == len(served)
                for value, actual_value in zip(original, served, strict=True):
                    compare(value, actual_value)
            elif isinstance(original, float) and isinstance(served, (float, int)):
                # JSON module compilation/serialization may differ by one IEEE754 bit.
                # No scientific rounding, NULL substitution or source-file change.
                assert abs(original - served) <= max(
                    math.ulp(original), math.ulp(served)
                )
                float64_transport_adjustments += 1
            else:
                raise TypeError((original, served))

        for key in protected:
            compare(protected[key], remote[key])
        crops.append(
            {
                "indicator": identifier,
                "rows": len(remote["rows"]),
                "protected_file_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "one_ulp_json_roundtrips": float64_transport_adjustments,
            }
        )
    report = {
        "mocked": False,
        "date": args.date,
        "source": "actual immutable checkpoints",
        "pra_rows": 713,
        "scalar_comparisons_including_null": comparisons,
        "float_policy": "existing Task19C float4_matches; no new tolerance",
        "unified_rows_by_indicator": unified_counts,
        "crop_artifacts_unchanged": crops,
        "elapsed_seconds": monotonic() - mark,
        "catalog": catalog,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2))
    print(json.dumps(report))


if __name__ == "__main__":
    main()
