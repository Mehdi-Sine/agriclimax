"""Manual T34 collection. No scheduling, database or publication writes."""

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "engine" / "src"))
from agriclimax.news.batch import archive, collect


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--registry", type=Path, default=Path("config/news/sources.v1.json")
    )
    parser.add_argument(
        "--events", type=Path, help="Real archived JournalEdition or WatchSummary"
    )
    parser.add_argument(
        "--output", type=Path, required=True, help="Local archive directory"
    )
    parser.add_argument("--bundle", type=Path, help="Optional review/export JSON")
    args = parser.parse_args()
    bundle = collect(
        args.registry.read_bytes(),
        now=datetime.now(UTC),
        event_archive=args.events.read_bytes() if args.events else None,
    )
    metrics = archive(bundle, args.output)
    if args.bundle:
        args.bundle.parent.mkdir(parents=True, exist_ok=True)
        args.bundle.write_text(bundle.model_dump_json(indent=2) + "\n")
    print(
        json.dumps(
            {
                "bundle_id": bundle.bundle_id,
                **metrics,
                "sources": {r.source_id: r.status for r in bundle.sources},
                "useful": sum(p.relevance != "rejected" for p in bundle.publications),
                "links": len(bundle.links),
            },
            indent=2,
        )
    )
    if not any(s.status == "ok" for s in bundle.sources):
        raise SystemExit(2)


if __name__ == "__main__":
    main()
