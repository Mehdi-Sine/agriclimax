"""One bounded acquisition owner. Scientific adapters remain the existing T26/T33/T34 code."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import UTC, datetime, timedelta
from datetime import date as calendar_date
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'engine/src'))
from agriclimax.ingestion.meteofrance import NoRedirect


def rpc(action: str, payload: dict[str, Any] | None = None) -> Any:
    base = os.environ['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/')
    if base != 'https://yyfbpecxvxglzxopsmel.supabase.co':
        raise ValueError('DEV_ORIGIN_REQUIRED')
    request = Request(base + '/rest/v1/rpc/agriclimax_editorial', method='POST',
                      headers={'apikey': os.environ['SUPABASE_SECRET_KEY'], 'Content-Type': 'application/json'},
                      data=json.dumps({'p_action': action, 'p_payload': payload or {}}).encode())
    with build_opener(NoRedirect()).open(request, timeout=15) as response:
        return json.loads(response.read(16 * 1024**2))


def failure(status: int | None, retry_after: str | None = None) -> tuple[str, int]:
    """No request storm: auth failures terminal; bounded retries honor supplier cooldown."""
    from email.utils import parsedate_to_datetime
    wait = 1800
    if retry_after:
        try:
            wait = max(wait, int(retry_after))
        except ValueError:
            try:
                wait = max(wait, int((parsedate_to_datetime(retry_after) - datetime.now(UTC)).total_seconds()))
            except (ValueError, TypeError):
                pass
    if status in (401, 403):
        return 'permanent_failure', wait
    if status in (404, 204):
        return 'no_new_data', wait
    if status == 429 or status is None or (status is not None and status >= 500):
        return 'retryable_failure', wait
    return 'permanent_failure', wait


def commands(source: str, edition_date: str | None = None) -> list[list[str]]:
    py = sys.executable
    edition = calendar_date.fromisoformat(edition_date) if edition_date else datetime.now(ZoneInfo('Europe/Paris')).date()
    end = edition - timedelta(days=1)
    forecast_date = ['--latest-available'] if edition == datetime.now(ZoneInfo('Europe/Paris')).date() else ['--run-date', str(edition)]
    return {
        'forecast': [[py, 'scripts/restore_daily_checkpoint.py', 'weather', 'work/national-weather'],
                     [py, 'scripts/national_weather.py', '--mode', 'national', *forecast_date, '--execute', '--national-authorized', '--publish-dev']],
        'era5': [[py, 'scripts/restore_daily_checkpoint.py', 'era5', 'work/era5-archive'],
                 [py, 'scripts/era5_archive_daily.py', '--root', 'work/era5-archive', '--max-downloads', '64', '--execute', '--publish-dev']],
        'stations': [[py, 'scripts/daily_live.py', '--from', str(end-timedelta(days=6)), '--to', str(end)]],
        'observations': [[py, 'scripts/ingest_weather.py', '--mode', 'live_meteofrance',
                          '--product', 'observations', '--daily', '--root', 'work/station-observations']],
        'news': [[py, 'scripts/task34_news.py', '--output', 'work/task36/news', '--bundle', 'work/task36/news.json']],
    }[source]


def acquire(source: str, date: str) -> dict[str, Any]:
    metadata = {'edition_date': date, 'source': source, 'command': 'acquire',
                'dispatch_id': os.environ.get('AGRICLIMAX_DISPATCH_ID'),
                'workflow_run_id': os.environ.get('GITHUB_RUN_ID'),
                'scheduled_at': os.environ.get('AGRICLIMAX_SCHEDULED_AT'),
                'scheduled_at_basis': os.environ.get('AGRICLIMAX_SCHEDULED_AT_BASIS'),
                'recovery': os.environ.get('AGRICLIMAX_RECOVERY') == 'true'}
    if source == 'observations' and date != datetime.now(ZoneInfo('Europe/Paris')).date().isoformat():
        return {'source':source,'status':'no_op','reason':'historical_instantaneous_observations_unavailable'}
    claim = rpc('claim', metadata)
    if not claim or claim.get('status') == 'no_op':
        no_op = {'source': source, 'status': 'no_op', 'reason': (claim or {}).get('reason', 'not_eligible')}
        rpc('diagnostic', {'edition_date': date, 'id': f"acquire-noop-{date}-{source}-{os.environ.get('GITHUB_RUN_ID', time.time_ns())}", 'body': {**metadata, **no_op, 'state': 'no_op', 'finished_at': datetime.now(UTC).isoformat()}})
        return no_op
    os.environ['AGRICLIMAX_ACQUISITION_LEASE_TOKEN'] = claim['token']
    os.environ['AGRICLIMAX_ACQUISITION_SOURCE'] = source
    os.environ['AGRICLIMAX_ACQUISITION_DATE'] = date
    started = time.monotonic()
    checkpoint: dict[str, Any] = {'source': source, 'started_at': datetime.now(UTC).isoformat(), 'workflow_run_id': os.environ.get('GITHUB_RUN_ID'),
                                       'scheduled_at': os.environ.get('AGRICLIMAX_SCHEDULED_AT'),
                                       'scheduled_at_basis': os.environ.get('AGRICLIMAX_SCHEDULED_AT_BASIS'),
                                       'dispatch_id': os.environ.get('AGRICLIMAX_DISPATCH_ID')}
    state, wait = 'retryable_failure', 1800
    try:
        Path('work/task36/logs').mkdir(parents=True, exist_ok=True)
        with Path(f'work/task36/logs/{source}.log').open('w') as log:
            # The adapter owns its compact, checksum-verified recovery files. No raw grids in registry.
            for cmd in commands(source, date):
                remaining = max(1, 1320 - int(time.monotonic() - started))
                result = subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT, timeout=remaining, check=False)
                if result.returncode:
                    checkpoint['exit_code'] = result.returncode
                    break
            else:
                state = 'success'
        report_path = {'forecast':'work/national-weather/report.json','era5':'work/era5-archive/report.json',
                       'observations':'work/station-observations/source-failure.json',
                       'stations':'work/daily/logs/run.json','news':'work/task36/news.json'}[source]
        if source == 'observations' and (state == 'success' or not Path(report_path).exists()):
            manifests = sorted(Path('work/station-observations/manifests').glob('*.json'), key=lambda p: p.stat().st_mtime)
            if manifests:
                report_path = str(manifests[-1])
        if Path(report_path).exists():
            report = json.loads(Path(report_path).read_text())
            checkpoint['report'] = report
            if source == 'news' and not any(s.get('status') == 'ok' for s in report.get('sources', [])):
                state = 'degraded'
            if state == 'success' and (report.get('status') in ('no_new_data','read_only_existing_archive','not_yet_available_by_conservative_publication_ceiling') or report.get('inserted') is False):
                state = 'no_new_data'
            if report.get('status') == 'partial_previous_publication_preserved':
                state = 'degraded'
            if report.get('permanent_auth_failure'):
                state = 'permanent_failure'
            if isinstance(report.get('http_status'), int):
                state, wait = failure(report['http_status'], report.get('retry_after'))
            for issue in [*report.get('source_failures', []), *report.get('days', [])]:
                status = issue.get('http_status', issue.get('status_code',issue.get('status')))
                if isinstance(status, int):
                    state, wait = failure(status, issue.get('retry_after'))
        if state == 'success' and source != 'news':
            checkpoint['result'] = 'adapter_completed_qualification_retained'
    except HTTPError as error:
        state, wait = failure(error.code, error.headers.get('Retry-After'))
        checkpoint['error'] = f'HTTP_{error.code}'
    except (TimeoutError, URLError, subprocess.TimeoutExpired):
        checkpoint['error'] = 'TIMEOUT_OR_NETWORK'
    except Exception:  # noqa: BLE001 - safe boundary, no arbitrary exception text
        state = 'permanent_failure'
        checkpoint['error'] = 'ADAPTER_CONTRACT_OR_CONFIGURATION'
    checkpoint['finished_at'] = datetime.now(UTC).isoformat()
    checkpoint['elapsed_seconds'] = round(time.monotonic() - started, 3)
    rpc('finish', {'edition_date': date, 'source': source, 'token': claim['token'],
                   'state': state, 'retry_after_seconds': wait, 'checkpoint': checkpoint})
    outcome = {'source': source, 'state': state, 'seconds': checkpoint['elapsed_seconds']}
    rpc('diagnostic', {'edition_date': date, 'id': f"acquire-result-{date}-{source}-{os.environ.get('GITHUB_RUN_ID', time.time_ns())}",
                       'body': {**metadata, 'acquisition_state': state, 'state': 'failed' if state in ('retryable_failure', 'permanent_failure') else 'completed',
                                'finished_at': checkpoint['finished_at']}})
    return outcome


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', choices=['forecast', 'era5', 'stations', 'observations', 'news'], required=True)
    args = parser.parse_args()
    date = os.environ.get('AGRICLIMAX_EDITION_DATE') or datetime.now(ZoneInfo('Europe/Paris')).date().isoformat()
    datetime.strptime(date, '%Y-%m-%d')
    result = acquire(args.source, date)
    print(json.dumps(result))
    if result.get('state') in ('retryable_failure', 'permanent_failure'):
        sys.exit(1)


if __name__ == '__main__':
    main()
