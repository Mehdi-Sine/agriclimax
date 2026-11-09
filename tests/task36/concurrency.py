"""LOCAL disposable PostgreSQL only: two competing financial reservations."""
import concurrent.futures
import subprocess
import sys

container = sys.argv[1]
base = ['docker','--host=unix:///var/run/docker.sock','exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1']
setup = """
update agriclimax_private.editorial_control set ai_enabled=true;
insert into agriclimax_private.editorial_snapshots(edition_date,id,quality,frozen_at,body,serialized)
values(current_date,repeat('a',64),'fresh',now(),'{}','{}');
"""
subprocess.run(base, input=setup, text=True, check=True, capture_output=True)

def reserve(letter):
    query = f"""set role service_role; select public.agriclimax_editorial('reserve',jsonb_build_object(
    'id',repeat('{letter}',64),'snapshot_id',repeat('a',64),'edition_date',current_date,
    'run',jsonb_build_object('id',repeat('{letter}',64),'edition_date',current_date,
    'month',to_char(now(),'YYYY-MM'),'state','reserved','reserved_eur',.15)));
    """
    return subprocess.run(base, input=query, text=True, capture_output=True, check=False)

with concurrent.futures.ThreadPoolExecutor(2) as pool:
    results = list(pool.map(reserve, ['b','c']))
assert sum(r.returncode==0 for r in results)==1, 'Expected exactly one reservation'
assert any('UNRECONCILED_GENERATION' in r.stderr for r in results), 'Expected concurrent reservation refusal'
print('Two concurrent connections: exactly one committed reservation, one refused; no provider call.')
