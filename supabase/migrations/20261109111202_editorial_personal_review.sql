-- Private draft availability and an independent, immutable editorial decision.
-- No acquisitions, AI, publication, Cron or external dispatch is activated.
create table agriclimax_private.editorial_reviews (
 archive_id text primary key references agriclimax_private.editorial_archives(id),
 checksum text not null check(checksum ~ '^[a-f0-9]{64}$'),
 decision text not null check(decision in ('approved','rejected')),
 reviewed_by text not null check(length(trim(reviewed_by))>=3),
 reviewed_at timestamptz not null default now()
);
alter table agriclimax_private.editorial_reviews enable row level security;
alter table agriclimax_private.editorial_reviews force row level security;
revoke all on agriclimax_private.editorial_reviews from public,anon,authenticated;
grant select,insert on agriclimax_private.editorial_reviews to service_role;
-- Preserve the already deployed core verbatim; add the review boundary without rewriting it.
alter function public.agriclimax_editorial(text,jsonb) set schema agriclimax_private;
revoke all on function agriclimax_private.agriclimax_editorial(text,jsonb) from public,anon,authenticated;
grant execute on function agriclimax_private.agriclimax_editorial(text,jsonb) to service_role;
create function public.agriclimax_editorial(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' set statement_timeout='8s' as $$
declare
 item jsonb; result jsonb;
 reviewed agriclimax_private.editorial_reviews%rowtype;
begin
 if p_action='private_editions' then
  select coalesce(jsonb_agg(to_jsonb(q.serialized) order by q.edition_date desc),'[]') into result
  from (select a.serialized,a.edition_date from agriclimax_private.editorial_archives a
   join agriclimax_private.editorial_runs r on r.id=a.id
   where r.state='completed' and a.body->>'mode'='live'
    and jsonb_typeof(a.body->'receipt')='object'
    and a.body->'validation'->>'status' in ('validated_automatically','needs_editorial_review')
    and jsonb_array_length(a.body->'validation'->'errors')=0
   order by a.edition_date desc limit 30) q;
  return result;
 elsif p_action='reviews' then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into result from agriclimax_private.editorial_reviews r;
  return result;
 elsif p_action='review' then
  select body into item from agriclimax_private.editorial_archives where id=p_payload->>'id';
  if item is null or item->>'mode' is distinct from 'live'
    or item->>'checksum' is distinct from p_payload->>'checksum'
    or coalesce(item->'validation'->>'status','') not in ('validated_automatically','needs_editorial_review')
    or jsonb_array_length(item->'validation'->'errors')<>0
    or coalesce(p_payload->>'decision','') not in ('approved','rejected')
    or length(trim(coalesce(p_payload->>'reviewer','')))<3
    or not exists(select 1 from agriclimax_private.editorial_runs where id=p_payload->>'id' and state='completed')
    then raise exception 'EDITORIAL_REVIEW_REJECTED'; end if;
  insert into agriclimax_private.editorial_reviews(archive_id,checksum,decision,reviewed_by)
   values(p_payload->>'id',p_payload->>'checksum',p_payload->>'decision',trim(p_payload->>'reviewer'))
   on conflict(archive_id) do nothing;
  select * into reviewed from agriclimax_private.editorial_reviews where archive_id=p_payload->>'id';
  if reviewed.checksum is distinct from p_payload->>'checksum' or reviewed.decision is distinct from p_payload->>'decision'
    or reviewed.reviewed_by is distinct from trim(p_payload->>'reviewer') then raise exception 'IMMUTABLE_REVIEW_CONFLICT'; end if;
  return to_jsonb(reviewed);
 elsif p_action='promote' then
  if not (select publication_enabled from agriclimax_private.editorial_control where singleton) then raise exception 'PUBLICATION_DISABLED'; end if;
  select * into reviewed from agriclimax_private.editorial_reviews where archive_id=p_payload->>'id';
  if reviewed.archive_id is null or reviewed.decision<>'approved' or reviewed.checksum is distinct from p_payload->>'checksum'
    then raise exception 'EDITORIAL_APPROVAL_REQUIRED'; end if;
  return agriclimax_private.agriclimax_editorial(p_action,p_payload||jsonb_build_object('reviewed_by',reviewed.reviewed_by));
 elsif p_action='qualification_status' then
  return jsonb_build_object('financial_lock_available',pg_try_advisory_xact_lock(360035),
   'control',(select to_jsonb(c) from agriclimax_private.editorial_control c),
   'runs',(select count(*) from agriclimax_private.editorial_runs),
   'published',(select count(*) from agriclimax_private.editorial_publications));
 end if;
 return agriclimax_private.agriclimax_editorial(p_action,p_payload);
end $$;
revoke all on function public.agriclimax_editorial(text,jsonb) from public,anon,authenticated;
grant execute on function public.agriclimax_editorial(text,jsonb) to service_role;
