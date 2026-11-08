"""Pure planning and read-only supervision for the existing daily climate workflow."""
from __future__ import annotations

import argparse
import json
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


def next_day(known: set[date], anchor: date, today: date) -> tuple[date | None, str]:
    """Repair the earliest catalogue hole, then advance; never imply provider delivery."""
    ceiling = today - timedelta(days=6)
    first = min({anchor + timedelta(days=1), *known})
    for offset in range((ceiling-first).days+1):
        day = first+timedelta(days=offset)
        if day not in known and day > anchor:
            return day, 'missing_archive'
    return None, 'waiting_for_provider_window'


def publication_deadline(day: date) -> datetime:
    return datetime.combine(day, time(6, 30), ZoneInfo('Europe/Paris')).astimezone(UTC)


def inspect(catalogue: dict[str, Any], now: datetime) -> dict[str, Any]:
    days = sorted({d for e in catalogue['era5'] for d in e['dates']})
    holes = []
    if days:
        start, end = date.fromisoformat(days[0]), date.fromisoformat(days[-1])
        holes = [str(start+timedelta(days=n)) for n in range((end-start).days+1)
                 if str(start+timedelta(days=n)) not in days]
    latest = days[-1] if days else None
    lag = (now.date()-date.fromisoformat(latest)).days if latest else None
    status = 'error' if not days or holes else 'stale' if lag is not None and lag > 7 else 'within_conservative_reanalysis_window'
    return {'version': 'data01-monitor-1', 'checked_at': now.isoformat(), 'latest_reanalysis': latest,
            'lag_days': lag, 'missing_dates': holes, 'status': status,
            'provider_delivery_verified': False, 'remote_writes': 0,
            'deadline_utc': publication_deadline(now.astimezone(ZoneInfo('Europe/Paris')).date()).isoformat()}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalogue', type=Path)
    parser.add_argument('--output', type=Path, default=Path('work/data01/daily-monitor.json'))
    args = parser.parse_args()
    if args.catalogue:
        catalogue = json.loads(args.catalogue.read_bytes())
    else:
        from pra_weather_store import ArchiveStore
        catalogue = ArchiveStore(read_only=True).catalogue()
    report = inspect(catalogue, datetime.now(UTC))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2))
    print(json.dumps(report))
    raise SystemExit(1 if report['status'] in ('error', 'stale') else 0)


if __name__ == '__main__':
    main()
