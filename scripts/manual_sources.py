"""Bounded local acquisitions. No publication, DB persistence or shared pointer writes."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import UTC, date, datetime, timedelta
from pathlib import Path


def source_commands(edition: date, root: Path) -> dict[str, list[str]]:
    py = sys.executable
    end = edition-timedelta(days=1)
    forecast_date = ['--latest-available'] if edition == datetime.now(UTC).date() else ['--run-date', str(edition)]
    return {
        'forecast': [py, 'scripts/national_weather.py', '--mode', 'national', *forecast_date, '--execute', '--national-authorized', '--root', str(root/'forecast')],
        'era5': [py, 'scripts/era5_archive_daily.py', '--root', str(root/'era5'), '--max-downloads', '64', '--execute'],
        'stations': [py, 'scripts/ingest_weather.py', '--mode', 'live_meteofrance', '--product', 'climatology', '--from', str(end-timedelta(days=6)), '--to', str(end), '--dry-run', '--root', str(root/'stations')],
        'observations': [py, 'scripts/ingest_weather.py', '--mode', 'live_meteofrance', '--product', 'observations', '--from', str(edition), '--to', str(edition), '--dry-run', '--root', str(root/'observations')],
        'news': [py, 'scripts/task34_news.py', '--output', str(root/'news'), '--bundle', str(root/'news.json')],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--edition-date', type=date.fromisoformat, required=True)
    parser.add_argument('--root', type=Path, required=True)
    args = parser.parse_args()
    args.root.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, object]] = []
    started = time.monotonic()
    # A verified national acquisition takes >600 s; keep a shared 21-minute cap.
    limits = {'forecast': 1250, 'era5': 420, 'stations': 90, 'observations': 30, 'news': 60}
    for source, command in source_commands(args.edition_date, args.root).items():
        if source == 'observations' and args.edition_date != datetime.now(UTC).date():
            results.append({'source':source,'status':'not_available','reason':'historical_instantaneous_observations_unavailable'})
            continue
        try:
            remaining = 1250 - (time.monotonic() - started)
            if remaining <= 0:
                results.append({'source':source,'status':'not_attempted','reason':'shared_source_time_budget_exhausted'})
                continue
            with (args.root/(source+'.log')).open('w') as log:
                result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, timeout=min(limits[source], remaining), check=False)
            item: dict[str, object] = {'source':source,'status':'completed' if result.returncode == 0 else 'failed','exit_code':result.returncode,'scope':'isolated_local_validation'}
            receipts = list((args.root/source).glob('manifests/*.json'))
            candidates = [args.root/source/'report.json', args.root/source/'source-failure.json', *receipts[-1:]]
            for path in candidates:
                if not path.exists():
                    continue
                receipt = json.loads(path.read_text())
                item['receipt'] = {key: receipt[key] for key in ['status','date','run','from','to','successful','source_requests','source_bytes','restored_rows','http_status','retry_after','permanent_auth_failure'] if key in receipt}
                if isinstance(receipt.get('days'), list):
                    item['coverage'] = [{key: day.get(key) for key in ['date','status','observation_count','available_count','issues']} for day in receipt['days']]
                break
            results.append(item)
        except subprocess.TimeoutExpired:
            results.append({'source':source,'status':'failed','reason':'source_time_budget_exhausted'})
    (args.root/'results.json').write_text(json.dumps(results, indent=2)+'\n')
    print(json.dumps(results))


if __name__ == '__main__':
    main()
