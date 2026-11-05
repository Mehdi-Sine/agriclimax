"""Read-only fixed-endpoint access check, no ingestion, no credential diagnostics."""

import json
import os
from pathlib import Path
from time import monotonic
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener

from agriclimax.ingestion.meteofrance import NoRedirect


def main() -> None:
    origin = "https://public-api.meteofrance.fr/public/"
    paths = (
        (
            "observations-v1",
            "DPObs/v1/liste-stations",
            "METEOFRANCE_OBSERVATIONS_API_KEY",
        ),
        (
            "observations-v2",
            "DPObs/v2/liste-stations",
            "METEOFRANCE_OBSERVATIONS_API_KEY",
        ),
        (
            "package-observations-v2",
            "DPPaquetObs/v2/liste-stations",
            "METEOFRANCE_OBSERVATIONS_API_KEY",
        ),
        (
            "arome",
            "arome/1.0/wcs/MF-NWP-HIGHRES-AROME-0025-FRANCE-WCS/GetCapabilities?service=WCS&version=2.0.1&request=GetCapabilities",
            "METEOFRANCE_OBSERVATIONS_API_KEY",
        ),
        (
            "arpege",
            "arpege/1.0/wcs/MF-NWP-GLOBAL-ARPEGE-01-EUROPE-WCS/GetCapabilities?service=WCS&version=2.0.1&request=GetCapabilities",
            "METEOFRANCE_OBSERVATIONS_API_KEY",
        ),
        (
            "climatology",
            "DPClim/v1/liste-stations/quotidienne?id-departement=29",
            "METEOFRANCE_CLIMATOLOGY_API_KEY",
        ),
    )
    results = []
    root = Path("work/operational-access")
    root.mkdir(parents=True, exist_ok=True)
    for product, path, variable in paths:
        started = monotonic()
        content = b""
        status: int | str = "binding_absent"
        if os.environ.get(variable):
            try:
                request = Request(
                    origin + path, headers={"apikey": os.environ[variable]}
                )
                with build_opener(NoRedirect()).open(request, timeout=25) as response:
                    status = response.status
                    content = response.read(1500001)
                if len(content) > 1500000:
                    status = "response_budget_exceeded"
                    content = b""
                elif status == 200:
                    (root / f"{product}.source").write_bytes(content)
            except HTTPError as error:
                status = error.code
            except (URLError, OSError, TimeoutError):
                status = "network_unavailable"
        results.append(
            {
                "product": product,
                "url": origin + path,
                "status": status,
                "bytes": len(content),
                "seconds": monotonic() - started,
            }
        )
    (root / "access.json").write_text(json.dumps(results, indent=2))
    print(json.dumps(results))


if __name__ == "__main__":
    main()
