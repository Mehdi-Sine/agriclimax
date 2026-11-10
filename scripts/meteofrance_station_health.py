"""Read-only DPClim/DPObs health: two catalogues, no orders, ingestion, DB or AI."""

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from agriclimax.ingestion.meteofrance import (
    MeteoFranceAccessError,
    MeteoFranceClient,
    MeteoFranceTransportError,
    csv_rows,
)


def probe(product: Literal["climatology", "observations"], *, observations_version: str = "v1") -> dict[str, object]:
    stem = "METEOFRANCE_CLIMATOLOGY" if product == "climatology" else "METEOFRANCE_OBSERVATIONS"
    result: dict[str, object] = {"product": product, "access_only": True, "scientific_data_qualified": False,
                                 "credential_bindings": [stem + "_API_KEY", stem + "_APPLICATION_ID"],
                                 "endpoint": "DPClim/v1" if product == "climatology" else "DPObs/" + observations_version}
    try:
        client = MeteoFranceClient(product)
        if product == "observations":
            client.prefix = "DPObs/" + observations_version
        result.update(endpoint=client.prefix, auth_mode=client.auth.mode, credential_binding=client.variable)
        path, params = (("liste-stations/quotidienne", {"id-departement": "29"})
                        if product == "climatology" else ("liste-stations", None))
        status, content = client.get(path, params, retry_transient=False, byte_limit=1_000_000)
        if product == "climatology":
            records = json.loads(content)
            compatible = isinstance(records, list) and bool(records) and all(
                isinstance(r, dict) and {"id", "nom", "lat", "lon", "alt"} <= r.keys() for r in records)
        else:
            records = csv_rows(content)
            compatible = bool(records) and {"Id_station", "Nom_usuel", "Latitude", "Longitude", "Altitude"} <= records[0].keys()
        result.update(http_status=status, status="access_succeeded" if status == 200 and compatible else "endpoint_incompatible")
    except MeteoFranceAccessError as error:
        result.update(status=error.reason, http_status=error.http_status, phase=error.phase, service_code=error.service_code)
    except MeteoFranceTransportError as error:
        result.update(status="endpoint_incompatible" if error.http_status in {404, 405, 410}
                      else "rate_limited" if error.http_status == 429 else "service_unavailable", http_status=error.http_status)
    except (ValueError, KeyError, TypeError, UnicodeError):
        result.update(status="endpoint_incompatible")
    except (RuntimeError, OSError):
        result.update(status="network_unavailable")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--observations-version", choices=["v1", "v2"], default="v1",
                        help="v1 matches ingestion; v2 is a read-only compatibility probe, never a migration")
    parser.add_argument("--output", type=Path, default=Path("work/meteofrance-station-health/report.json"))
    args = parser.parse_args()
    results = [probe("climatology"), probe("observations", observations_version=args.observations_version)]
    report = {"observed_at": datetime.now(UTC).isoformat(), "results": results}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))
    return 0 if all(r["status"] == "access_succeeded" for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
