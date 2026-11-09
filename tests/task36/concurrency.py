"""LOCAL disposable PostgreSQL only: two competing financial reservations."""
import concurrent.futures
import subprocess
import sys

container = sys.argv[1]
operational = len(sys.argv)>2 and sys.argv[2]=="operational"
base = ['docker','--host=unix:///var/run/docker.sock','exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1']
setup = """
update agriclimax_private.editorial_control set ai_enabled=true;
insert into agriclimax_private.editorial_snapshots(edition_date,id,quality,frozen_at,body,serialized)
values(current_date,repeat('a',64),'fresh',now(),'{}','{}');
"""
if operational:
    setup=setup.replace("current_date", "current_date+1").replace("repeat('a',64)","repeat('d',64)")
subprocess.run(base, input=setup, text=True, check=True, capture_output=True)

def reserve(letter):
    query = f"""set role service_role; select public.agriclimax_editorial('reserve',jsonb_build_object(
    'id',repeat('{letter}',64),'snapshot_id',repeat('a',64),'edition_date',current_date,
    'run',jsonb_build_object('id',repeat('{letter}',64),'edition_date',current_date,
    'month',to_char(now(),'YYYY-MM'),'state','reserved','reserved_eur',.15)));
    """
    if operational:
        query=f"""set role service_role; select public.agriclimax_editorial_attempt('attempt_claim',jsonb_build_object(
        'snapshot_id',repeat('d',64),'edition_date',current_date+1,'manual_retry',true,
        'run',jsonb_build_object('id',repeat('{letter}',64),'edition_date',current_date+1,
        'month',to_char(now(),'YYYY-MM'),'scope','daily','state','running','reserved_eur',0,'actual_eur',null)));
        """
    return subprocess.run(base, input=query, text=True, capture_output=True, check=False)

with concurrent.futures.ThreadPoolExecutor(2) as pool:
    results = list(pool.map(reserve, ['e','f'] if operational else ['b','c']))
assert sum(r.returncode==0 for r in results)==1, 'Expected exactly one reservation'
assert any(('EDITION_ATTEMPT_ALREADY_RUNNING' if operational else 'UNRECONCILED_GENERATION') in r.stderr for r in results), 'Expected concurrent reservation refusal'
print('Two concurrent connections: exactly one claim, one refused; no provider call. Operational=' + str(operational))
