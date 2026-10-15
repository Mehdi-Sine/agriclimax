-- LOCAL ONLY: deterministic synthetic portfolio, rolled back; never seed DEV.
begin;
set local search_path=public,extensions;
insert into agriclimax_private.weather_stations(id,name,geom,altitude_m,metadata,retrieved_at)
values('35281001','Synthetic test station',ST_SetSRID(ST_MakePoint(-1.7,48.1),4326),0,'{}',now());
\set wheat_payload `cat /repo/supabase/tests/wheat-portfolio.json`
select set_config('test.wheat_payload', :'wheat_payload', true);
set local role service_role;
do $$
declare p jsonb:=current_setting('test.wheat_payload')::jsonb; q jsonb; rejected boolean:=false;
begin
  if not public.agriclimax_persist_wheat(repeat('a',64),p) then raise exception 'Initial wheat write failed'; end if;
  if public.agriclimax_persist_wheat(repeat('a',64),p) then raise exception 'Wheat replay changed data'; end if;
  q:=public.agriclimax_wheat_portfolios('2026-09-01','2026-09-03',p->>'parameter_fingerprint');
  if jsonb_array_length(q)<>1 or q->0<>p then raise exception 'Wheat read changed payload'; end if;
  if public.agriclimax_wheat_portfolios('2026-09-01','2026-09-03',repeat('b',64))<>'[]'::jsonb
    then raise exception 'Wrong parameter version leaked'; end if;
  if public.agriclimax_wheat_portfolios('2026-09-01','2026-09-03',p->>'parameter_fingerprint',null,'anthese')<>'[]'::jsonb
    then raise exception 'Stage inferred'; end if;
  begin
    perform public.agriclimax_persist_wheat(repeat('a',64),jsonb_set(p,'{station_name}','"changed"'));
  exception when raise_exception then rejected:=true; end;
  if not rejected then raise exception 'Content collision accepted'; end if;
  rejected:=false;
  begin perform public.agriclimax_persist_wheat(repeat('b',64),jsonb_set(p,'{results,0,scientific_status}','"validated"'));
  exception when raise_exception then rejected:=true; end;
  if not rejected then raise exception 'Validated claim accepted'; end if;
  rejected:=false;
  begin perform public.agriclimax_wheat_inputs('35281001','2026-09-03','2026-09-01');
  exception when raise_exception then rejected:=true; end;
  if not rejected then raise exception 'Unbounded input accepted'; end if;
  q:=public.agriclimax_wheat_inputs('35281001','2026-09-01','2026-09-03');
  if q#>>'{station,id}'<>'35281001' or q->'batches'<>'[]'::jsonb
    then raise exception 'Wheat inputs malformed'; end if;
end $$;
reset role;
do $$
begin
  if has_table_privilege('anon','agriclimax_private.wheat_portfolios','SELECT')
    or has_table_privilege('authenticated','agriclimax_private.wheat_portfolios','INSERT')
    or has_table_privilege('service_role','agriclimax_private.wheat_portfolios','UPDATE,DELETE')
    or has_function_privilege('anon','public.agriclimax_wheat_inputs(text,date,date,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.agriclimax_persist_wheat(text,jsonb)','EXECUTE')
    or has_function_privilege('anon','public.agriclimax_wheat_portfolios(date,date,text,text,text)','EXECUTE')
    then raise exception 'Wheat privilege boundary violated'; end if;
end $$;
set local role anon;
do $$ begin
  begin perform public.agriclimax_wheat_portfolios('2026-09-01','2026-09-03',repeat('a',64));
    raise exception 'Anon read unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
