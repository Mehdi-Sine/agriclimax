"""Inspect or recover one missed edition using the existing T36 owners and validators."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from task36_nightly import acquire, rpc


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--edition-date', required=True)
    parser.add_argument('--execute', action='store_true', help='Prepare and make at most one ordinarily admitted OpenAI attempt')
    parser.add_argument('--acquire', nargs='*', choices=['stations', 'forecast', 'era5', 'observations', 'news'], default=[])
    args = parser.parse_args()
    day = datetime.strptime(args.edition_date, '%Y-%m-%d').date()
    if day.isoformat() != args.edition_date or day > datetime.now(ZoneInfo('Europe/Paris')).date():
        parser.error('A real, non-future edition date is required')
    report = rpc('report', {'edition_date': args.edition_date})
    snapshot = rpc('snapshot_read', {'edition_date': args.edition_date})
    print(json.dumps({'edition_date': args.edition_date, 'snapshot_id': snapshot.get('id') if snapshot else None,
                      'quality': snapshot.get('quality') if snapshot else 'absent',
                      'acquisitions': [{'source': a['source'], 'state': a['state']} for a in report.get('acquisitions', [])],
                      'execute': args.execute}))
    if not args.execute:
        return 0
    os.environ['AGRICLIMAX_EDITION_DATE'] = args.edition_date
    os.environ['AGRICLIMAX_RECOVERY'] = 'true'
    os.environ['PYTHON'] = sys.executable
    if not snapshot:
        for source in args.acquire:
            print(json.dumps(acquire(source, args.edition_date)))
    tsx = Path('apps/web/node_modules/.bin/tsx')
    if not tsx.exists():
        parser.error('Install the locked pnpm dependencies first')
    env = {**os.environ, 'NODE_OPTIONS': (os.environ.get('NODE_OPTIONS', '') + ' --conditions=react-server').strip()}
    for stage in ['prepare', 'run', 'report']:
        result = subprocess.run([str(tsx), 'scripts/task36_editorial.ts', stage, '--recover'], env=env, check=False)
        if result.returncode:
            print(json.dumps({'blocked_stage': stage, 'exit_code': result.returncode, 'previous_retained': True}))
            return result.returncode
    # Report checks database persistence AND the configured Journal health endpoint.
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
