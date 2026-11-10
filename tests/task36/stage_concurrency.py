"""Two real PostgreSQL connections share the preparation lease."""
import concurrent.futures
import json
import subprocess
import sys

base = ['docker', '--host=unix:///var/run/docker.sock', 'exec', '-i', sys.argv[1],
        'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt']


def claim(owner):
    query = "set role service_role; select public.agriclimax_editorial('stage_claim'," + \
        "jsonb_build_object('edition_date','2098-11-11','stage','prepare','owner','" + owner + "'));"
    result = subprocess.run(base, input=query, text=True, capture_output=True, check=True)
    return json.loads(result.stdout.strip())


with concurrent.futures.ThreadPoolExecutor(2) as pool:
    results = list(pool.map(claim, ['github-synthetic', 'supabase-synthetic']))
assert sum(r.get('state') == 'running' for r in results) == 1, results
assert sum(r.get('reason') == 'already_running' for r in results) == 1, results
print('GitHub/Supabase concurrent preparation: one owner, one explicit no-op; no provider call.')
