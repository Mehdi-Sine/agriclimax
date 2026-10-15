"""Fetch official DPObs catalogue; select <=96 geographical stations, export Task11 chunks."""

import argparse
import hashlib
import json
from pathlib import Path

from agriclimax.climate.coverage import select_stations
from agriclimax.ingestion.meteofrance import MeteoFranceClient, Station, csv_rows
from agriclimax.ingestion.storage import atomic_write


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=96)
    parser.add_argument(
        "--output", type=Path, default=Path("work/france-stations.json")
    )
    args = parser.parse_args()
    if not 1 <= args.limit <= 96:
        parser.error("Station budget must be 1-96")
    _, content = MeteoFranceClient("observations").get("liste-stations")
    checksum = hashlib.sha256(content).hexdigest()
    candidates = []
    for row in csv_rows(content):
        latitude, longitude = float(row["Latitude"]), float(row["Longitude"])
        if 41 <= latitude <= 52 and -6 <= longitude <= 10:
            candidates.append(
                Station(
                    id=row["Id_station"],
                    name=row["Nom_usuel"],
                    latitude=latitude,
                    longitude=longitude,
                    altitude_m=float(row["Altitude"]),
                    metadata={
                        **row,
                        "catalog_checksum": checksum,
                        "api_version": "DPObs/v1",
                    },
                )
            )
    selected = select_stations(candidates, args.limit)
    ids = [s.id for s in selected]
    atomic_write(
        args.output,
        json.dumps(
            {
                "source": "DPObs/v1/liste-stations",
                "catalog_sha256": checksum,
                "candidates": len(candidates),
                "selection": "deterministic_farthest_point_cosine_degrees",
                "interpolation": "none",
                "stations": [s.model_dump() for s in selected],
                "task11_chunks": [ids[i : i + 10] for i in range(0, len(ids), 10)],
                "daily_availability": "not_verified; DPClim membership checked by Task11 prepare",
            },
            indent=2,
        ).encode(),
    )
    print(json.dumps({"candidates": len(candidates), "selected": len(selected)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
