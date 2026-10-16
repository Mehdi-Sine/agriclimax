"""Run the bounded daily live pipeline, or replay only an exact publication receipt."""

import argparse
import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from agriclimax.daily import live_provider, publication_key, retry, run_daily
from agriclimax.ingestion.meteofrance import MVP_STATIONS
from agriclimax.ingestion.models import DayBatch
from agriclimax.ingestion.supabase import SupabaseStationRepository
from agriclimax.wheat.models import Parameters
from agriclimax.wheat.repository import WheatRepository


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from", dest="start", type=date.fromisoformat)
    parser.add_argument("--to", dest="end", type=date.fromisoformat)
    parser.add_argument("--stations", default=",".join(MVP_STATIONS))
    parser.add_argument("--root", type=Path, default=Path("work/daily"))
    parser.add_argument("--publish-receipt", type=Path)
    args = parser.parse_args()
    now = datetime.now(UTC)
    if bool(args.start) != bool(args.end):
        parser.error("Provide both dates or neither")
    end = args.end or now.date() - timedelta(days=1)
    start = args.start or end - timedelta(days=6)
    try:
        transport = WheatRepository()

        def publish(snapshot: dict[str, object]) -> object:
            receipt = transport.rpc(
                "agriclimax_publish_daily",
                {
                    "p_key": publication_key(snapshot),
                    "p_payload": snapshot,
                },
            )
            if type(receipt) is not bool:
                raise ValueError("Invalid publication receipt")
            return receipt

        if args.publish_receipt:
            snapshot = json.loads(args.publish_receipt.read_bytes())
            retry(lambda: publish(snapshot))
            print("Daily publication receipt accepted")
            return 0
        provider = live_provider(tuple(args.stations.split(",")), start, end, args.root)

        # Metadata is read by persist after provider.prepare populates it.
        class Repository:
            def persist(self, batch: DayBatch) -> bool:
                return SupabaseStationRepository(provider.stations).persist(batch)

        return (
            0
            if run_daily(
                provider,
                Repository(),
                publish,
                start=start,
                end=end,
                now=now,
                root=args.root,
                parameters=Parameters.model_validate_json(
                    Path("config/wheat-mvp.json").read_bytes()
                ),
                cattle_rule=Path("config/cattle/thi-v1.json"),
            )
            else 1
        )
    except Exception:  # noqa: BLE001 - no credentials/URL/exception text in logs
        print("Daily pipeline configuration/publication failed; consult the runbook")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
