"""Compute real daily station portfolios; explicit period, configuration and optional grid pairing."""

import argparse
import json
from datetime import date, datetime
from pathlib import Path

from agriclimax.climate.models import ReferenceDay
from agriclimax.ingestion.models import DayBatch
from agriclimax.ingestion.storage import atomic_write
from agriclimax.wheat.calculate import calculate
from agriclimax.wheat.models import Parameters, Window
from agriclimax.wheat.repository import WheatRepository


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--station", required=True)
    parser.add_argument("--start", type=date.fromisoformat, required=True)
    parser.add_argument("--end", type=date.fromisoformat, required=True)
    parser.add_argument("--config", type=Path, default=Path("config/wheat-mvp.json"))
    parser.add_argument(
        "--stage",
        choices=["tallage", "montaison", "epiaison", "anthese", "remplissage"],
    )
    parser.add_argument("--stage-source")
    parser.add_argument("--grid-cell")
    parser.add_argument("--grid-mapping-source")
    parser.add_argument("--dataset-version")
    parser.add_argument(
        "--references",
        type=Path,
        help="Read-only exported Task12 ReferenceDay JSON array",
    )
    parser.add_argument("--computed-at", type=datetime.fromisoformat, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--input",
        type=Path,
        help="Replay a captured real station/batches/references envelope",
    )
    parser.add_argument(
        "--inputs-output",
        type=Path,
        help="Capture non-secret inputs for reproducibility",
    )
    parser.add_argument("--persist-supabase", action="store_true")
    args = parser.parse_args()
    try:
        parameters = Parameters.model_validate_json(args.config.read_bytes())
        window = Window(
            start=args.start,
            end=args.end,
            stage=args.stage,
            stage_source=args.stage_source,
            mode="supplied_stage" if args.stage else "explicit_calendar",
        )
        if bool(args.grid_cell) != bool(args.grid_mapping_source) or (
            args.grid_cell and not args.dataset_version
        ):
            raise ValueError(
                "Grid mapping, source and dataset version required together"
            )
        repository = (
            WheatRepository() if not args.input or args.persist_supabase else None
        )
        if args.input:
            raw = json.loads(args.input.read_bytes())
        else:
            assert repository is not None
            stations = repository.rpc("agriclimax_weather_stations", {})
            if not isinstance(stations, list):
                raise TypeError("Invalid stations")
            station = next((s for s in stations if s["id"] == args.station), None)
            raw = {
                "station": station,
                "batches": repository.rpc(
                    "agriclimax_station_weather",
                    {
                        "p_station": args.station,
                        "p_source": "meteofrance-climatology",
                        "p_start": str(args.start),
                        "p_end": str(args.end),
                    },
                ),
                "references": json.loads(args.references.read_bytes())
                if args.references
                else [],
            }
        if not isinstance(raw, dict) or not isinstance(raw.get("station"), dict):
            raise TypeError("Unknown station or invalid upstream response")
        station = raw["station"]
        if station["id"] != args.station:
            raise ValueError("Captured station differs from requested station")
        portfolio = calculate(
            [DayBatch.model_validate(b) for b in raw["batches"]],
            station_id=args.station,
            station_name=station["name"],
            latitude=station["latitude"],
            longitude=station["longitude"],
            window=window,
            parameters=parameters,
            computed_at=args.computed_at,
            references=[
                ReferenceDay.model_validate(r)
                for r in raw["references"]
                if r["dataset"]["dataset_version"] == args.dataset_version
            ],
            grid_cell=args.grid_cell,
            grid_mapping_source=args.grid_mapping_source,
        )
        # Output precedes persistence so an exact replay can use this receipt after network failure.
        atomic_write(args.output, portfolio.model_dump_json(indent=2).encode())
        if args.inputs_output:
            atomic_write(
                args.inputs_output,
                json.dumps(raw, ensure_ascii=False, indent=2).encode(),
            )
        changed = (
            repository.persist(portfolio)
            if args.persist_supabase and repository
            else None
        )
        print(
            json.dumps(
                {
                    "station": args.station,
                    "results": len(portfolio.results),
                    "available": sum(r.value is not None for r in portfolio.results),
                    "changed": changed,
                    "reference_days": len(raw["references"]),
                    "risk_computed": False,
                }
            )
        )
        return 0
    except (ValueError, TypeError, KeyError, RuntimeError, OSError):
        # Do not print upstream bodies/headers that could contain server credentials.
        print(
            "Wheat computation failed: verify explicit window, station, config, grid pairing and server RPC access."
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
