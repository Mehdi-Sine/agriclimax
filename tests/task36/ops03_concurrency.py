"""Disposable PostgreSQL: simultaneous late freezes and paid attempts remain single-owner."""
import concurrent.futures
import json
import subprocess
import sys

base = ['docker', '--host=unix:///var/run/docker.sock', 'exec', '-i', sys.argv[1],
        'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt']


def query(sql):
    return subprocess.run(base, input='set role service_role; '+sql, text=True, capture_output=True, check=False)


def freeze(letter):
    return query(f"""select public.agriclimax_editorial('freeze',jsonb_build_object('edition_date',current_date-1,
    'snapshot',s,'snapshot_json',s::text)) from (select jsonb_build_object('version','daily-editorial-snapshot-1',
    'edition_date',current_date-1,'id',repeat('{letter}',64),'quality','fallback_valid',
    'cutoff_at',(((current_date-1)::text||' 05:40')::timestamp at time zone 'Europe/Paris'),'frozen_at',now()) s) t;""")


with concurrent.futures.ThreadPoolExecutor(2) as pool:
    frozen = list(pool.map(freeze, ['1', '2']))
assert all(r.returncode == 0 for r in frozen), [r.stderr for r in frozen]
bodies = [json.loads(json.loads(r.stdout)) for r in frozen]
assert bodies[0] == bodies[1], bodies
snapshot_id = bodies[0]['id']


def attempt(letter):
    return query(f"""select public.agriclimax_editorial_attempt('attempt_claim',jsonb_build_object(
    'snapshot_id','{snapshot_id}','edition_date',current_date-1,'manual_retry',false,
    'run',jsonb_build_object('id',repeat('{letter}',64),'edition_date',current_date-1,
    'month',to_char(now(),'YYYY-MM'),'scope','daily','state','running','reserved_eur',0,'actual_eur',null)));""")


with concurrent.futures.ThreadPoolExecutor(2) as pool:
    attempts = list(pool.map(attempt, ['3', '4']))
assert sum(r.returncode == 0 for r in attempts) == 1, [r.stderr for r in attempts]
assert any('EDITION_ATTEMPT_ALREADY_RUNNING' in r.stderr for r in attempts)
print('OPS-03 concurrent late recovery: one immutable snapshot and one paid-attempt admission.')
