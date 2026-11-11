"""Five bounded catalogue probes; no orders, field downloads, database or AI calls."""

import argparse
import json
import os
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlencode

from meteofrance_station_health import probe
from probe_operational_access import METADATA_LIMIT, MODELS, ORIGIN, capabilities, fetch


def model_probe(product: str) -> dict[str, object]:
    path, binding = MODELS[product]
    url = ORIGIN + path + "GetCapabilities?" + urlencode(
        {"service": "WCS", "version": "2.0.1", "request": "GetCapabilities"})
    transport, body = fetch(url, binding, METADATA_LIMIT)
    result: dict[str, object] = {
        "product": product, "endpoint": path, "credential_binding": binding,
        "auth_mode": "api_key", "http_status": transport["status"] if isinstance(transport["status"], int) else None,
        "status": transport.get("outcome", transport["status"]),
        "access_only": True, "scientific_data_qualified": False, "pra_coverage_verified": False,
        "wire_bytes_read": transport.get("wire_bytes_read", 0),
    }
    if transport["status"] == 200 and transport.get("outcome") == "received":
        try:
            ids = capabilities(body)
            result.update(status="access_succeeded", advertised_coverages=len(ids))
        except (ValueError, UnicodeError, ET.ParseError):
            result["status"] = "format_incompatible"
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("work/meteofrance-station-health/report.json"))
    args = parser.parse_args()
    results = [probe("climatology"), probe("observations"),
               probe("observations", observations_version="v2"),
               *[model_probe(product) for product in MODELS]]
    report = {"version": "mf-acquisition-health-1", "observed_at": datetime.now(UTC).isoformat(),
              "scope": "catalogues_only", "database_writes": 0, "openai_calls": 0,
              "data_freshness_verified": False, "results": results}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    summary = "## Météo-France — accès aux catalogues\n\n| Source | API | Auth | HTTP | Résultat |\n|---|---|---|---|---|\n"
    summary += "".join(f"| {r['product']} | {r['endpoint']} | {r.get('auth_mode', 'unavailable')} | {r.get('http_status')} | {r['status']} |\n" for r in results)
    summary += "\nUn catalogue accessible ne qualifie ni une acquisition, ni sa fraîcheur, ni les 713 PRA. DPObs v2 reste une sonde de compatibilité.\n"
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with Path(os.environ["GITHUB_STEP_SUMMARY"]).open("a") as stream:
            stream.write(summary)
    print(json.dumps(report))
    # v2 is diagnostic only; production still uses v1 and must pass separately.
    return 0 if all(r["status"] == "access_succeeded" for i, r in enumerate(results) if i != 2) else 1


if __name__ == "__main__":
    raise SystemExit(main())
