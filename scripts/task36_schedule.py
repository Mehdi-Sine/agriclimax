"""Resolve a stable event identity, never a stage from the runner's wall clock."""
from __future__ import annotations

import json
import os
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

SCHEDULES = {
    '50 5 * * *': ('run', [(5, 50)]),
    '45 6 * * *': ('report', [(6, 45)]),
}
STAGES = {'acquire', 'prepare', 'preflight', 'qualify', 'run', 'report'}


def resolve(event: dict[str, Any], created_at: str, started_at: str) -> dict[str, str]:
    created = datetime.fromisoformat(created_at)
    inputs = event.get('inputs') or {}
    cron = event.get('schedule')
    scheduled = None
    if cron:
        stage, times = SCHEDULES[cron]  # unknown expressions fail closed
        local = created.astimezone(ZoneInfo('Europe/Paris'))
        # GitHub provides the cron expression, not the intended timestamp. Keep that
        # limitation explicit; anchor retries to immutable run.created_at.
        candidates = []
        for offset in (0, 1):
            day = local.date() - timedelta(days=offset)
            for hour, minute in times:
                for fold in (0, 1):
                    slot = datetime(day.year, day.month, day.day, hour, minute,
                                    tzinfo=ZoneInfo('Europe/Paris'), fold=fold).astimezone(UTC)
                    if slot <= created:
                        candidates.append(slot)
        scheduled = max(candidates).isoformat()
    else:
        stage = inputs.get('stage', 'report')
    if stage not in STAGES:
        raise ValueError('UNKNOWN_STAGE')
    date = inputs.get('edition_date') or datetime.fromisoformat(scheduled or created_at).astimezone(ZoneInfo('Europe/Paris')).date().isoformat()
    datetime.strptime(date, '%Y-%m-%d')
    return {'stage': stage, 'edition_date': date, 'scheduled_at': inputs.get('scheduled_at') or scheduled or '',
            'scheduled_at_basis': 'inferred_from_cron_and_run_created_at' if cron else 'dispatch',
            'started_at': started_at, 'event_schedule': cron or '',
            'dispatch_id': inputs.get('dispatch_id', '')}


def main() -> None:
    with open(os.environ['GITHUB_EVENT_PATH']) as stream:
        event = json.load(stream)
    result = resolve(event, os.environ['RUN_CREATED_AT'], datetime.now(UTC).isoformat())
    if result['stage'] == 'acquire':
        from task36_nightly import rpc

        sources = rpc('acquisition_plan', {
            **result,
            'workflow_run_id': os.environ['GITHUB_RUN_ID'],
            'command': 'acquire',
            'recovery': (event.get('inputs') or {}).get('recovery') == 'true',
        })
        result['sources'] = json.dumps(sources, separators=(',', ':'))
    with open(os.environ['GITHUB_OUTPUT'], 'a') as stream:
        for key, value in result.items():
            if '\n' in value or '\r' in value:
                raise ValueError('INVALID_EVENT_INPUT')
            stream.write(f'{key}={value}\n')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
