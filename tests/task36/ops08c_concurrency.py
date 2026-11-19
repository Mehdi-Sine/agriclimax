"""Simulate simultaneous publication and watchdog calls on separate PostgreSQL sessions."""
from concurrent.futures import ThreadPoolExecutor
import subprocess
import sys
from uuid import uuid4

base = [
    "docker", "--host=unix:///var/run/docker.sock", "exec", "-i", sys.argv[1],
    "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt",
]


def claim(claim_id):
    query = f"""
        set role service_role;
        select public.agriclimax_admin_report('smtp_claim', jsonb_build_object(
          'edition_date', (now() at time zone 'Europe/Paris')::date,
          'claim_id', '{claim_id}'))->>'status';
    """
    return subprocess.run(base, input=query, text=True, capture_output=True, check=True).stdout.strip()


with ThreadPoolExecutor(2) as pool:
    results = list(pool.map(claim, [uuid4(), uuid4()]))
assert sorted(results) == ["claimed", "uncertain"], results
print("Concurrent SMTP claims: one owner, one blocked; no SMTP call.")
