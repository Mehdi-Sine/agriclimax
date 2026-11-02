begin;
-- Forward-only: preserve the applied daily schema and add a live per-batch stop guard.
create or replace function public.agriclimax_persist_pra_climatology_daily(p_release text,p_reference text,
 p_provenance jsonb,p_rows jsonb)
returns integer language plpgsql security invoker
set search_path=pg_catalog set statement_timeout='15s' as $$
declare release_key integer; previous jsonb; previous_reference text; changed integer;
begin
 if not coalesce(length(p_release) between 1 and 100 and length(p_reference) between 1 and 80
   and jsonb_typeof(p_provenance)='object' and octet_length(p_provenance::text)<200000
   and p_provenance->>'rule_version'='pra-climatology-1991-2020-1'
   and p_provenance->>'source_id'='era5-land'
   and p_provenance->>'method'='pra-compact-daily-1'
   and p_provenance->>'source_manifest_sha256' ~ '^[a-f0-9]{64}$'
   and jsonb_typeof(p_rows)='array' and jsonb_array_length(p_rows) between 1 and 2000
   and octet_length(p_rows::text)<1000000,false)
 then raise exception 'Invalid bounded daily climatology import'; end if;
 -- One MiB conservatively covers a bounded 2,000-row batch and new metadata/index pages.
 if pg_database_size(current_database())+1000000>375000000
 then raise exception 'Daily climatology database guard exceeds 375 MB'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) j
   left join agriclimax_private.pra_territories t on t.version=p_reference and t.id=j->>'pra_id'
   where t.id is null)
 then raise exception 'PRA outside declared reference'; end if;
 if (select count(distinct (j->>'pra_id',j->>'day')) from jsonb_array_elements(p_rows) j)
   <>jsonb_array_length(p_rows)
 then raise exception 'Duplicate daily climatology keys'; end if;
 insert into agriclimax_private.pra_climatology_releases
   (version,reference_version,rule_version,reference_start_year,reference_end_year,provenance)
 values(p_release,p_reference,'pra-climatology-1991-2020-1',1991,2020,p_provenance)
 on conflict(version) do nothing;
 select id,provenance,reference_version into release_key,previous,previous_reference
 from agriclimax_private.pra_climatology_releases where version=p_release;
 if previous is distinct from p_provenance or previous_reference is distinct from p_reference
 then raise exception 'Immutable climatology release collision'; end if;
 insert into agriclimax_private.pra_climatology_support(release_id,reference_version,pra_id)
 select distinct release_key,p_reference,j->>'pra_id' from jsonb_array_elements(p_rows) j
 on conflict do nothing;
 if exists(select 1 from jsonb_to_recordset(p_rows) j(pra_id text,day smallint,
   tmin real,tmax real,tmean real,rain real,nmin smallint,nmax smallint,nmean smallint,nrain smallint)
   join agriclimax_private.pra_climatology_daily n
    on n.release_id=release_key and n.pra_id=j.pra_id and n.day=j.day
   where (n.tmin,n.tmax,n.tmean,n.rain,n.nmin,n.nmax,n.nmean,n.nrain)
    is distinct from (j.tmin,j.tmax,j.tmean,j.rain,j.nmin,j.nmax,j.nmean,j.nrain))
 then raise exception 'Immutable daily normal collision'; end if;
 insert into agriclimax_private.pra_climatology_daily
 select release_key,j.pra_id,j.day,j.tmin,j.tmax,j.tmean,j.rain,j.nmin,j.nmax,j.nmean,j.nrain
 from jsonb_to_recordset(p_rows) j(pra_id text,day smallint,
   tmin real,tmax real,tmean real,rain real,nmin smallint,nmax smallint,nmean smallint,nrain smallint)
 on conflict do nothing;
 get diagnostics changed=row_count;
 return changed;
end $$;
revoke all on function public.agriclimax_persist_pra_climatology_daily(text,text,jsonb,jsonb)
 from public,anon,authenticated;
grant execute on function public.agriclimax_persist_pra_climatology_daily(text,text,jsonb,jsonb) to service_role;

notify pgrst,'reload schema';
commit;
