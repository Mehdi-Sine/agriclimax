import 'server-only';
import { nationalData } from './national';
import { ApiError } from './query';
import { NATIONAL, type ClimateContextRow, type ClimateVariable } from '../../features/national/model';
import { aggregate, INDICATORS } from '../../features/unified/model';
import { nationalDays } from './national-availability';
import { calendarDays, withinAvailable } from '../../features/national/daily-availability';

// At most 60 map days retained, five minutes; no failed requests cached.
const cache = new Map<string, { expires: number; promise: Promise<ClimateContextRow[]> }>();
function day(date: string, variable: ClimateVariable, transport: typeof fetch) {
  const key=`${date}:${variable}`;
  const hit=cache.get(key);
  if(transport===fetch&&hit&&hit.expires>Date.now()) return hit.promise;
  const promise=nationalData(new URLSearchParams({action:'context-day',date,variable}),transport).then(r=>r.data as ClimateContextRow[]);
  if(transport===fetch) {
    if(cache.size>=60) cache.delete(cache.keys().next().value!);
    cache.set(key,{expires:Date.now()+300000,promise});
    void promise.catch(()=>{if(cache.get(key)?.promise===promise)cache.delete(key);});
  }
  return promise;
}
export async function unifiedData(params: URLSearchParams, transport: typeof fetch=fetch, signal?: AbortSignal) {
  const allowed=['start','end','indicator','threshold'];
  const start=params.get('start')??'',end=params.get('end')??'',id=params.get('indicator')??'';
  const definition=INDICATORS.find(i=>i.id===id);
  const threshold=Number(params.get('threshold')??definition?.parameter??25);
  const availableDays=await nationalDays(transport,[start,end]);
  const dates=calendarDays(start,end);
  if([...params.keys()].some(k=>!allowed.includes(k)||params.getAll(k).length!==1)||!withinAvailable(start,availableDays)||!withinAvailable(end,availableDays)||!dates.length||dates.length>30||!definition||!Number.isFinite(threshold)||threshold< -30||threshold>60) throw new ApiError('INVALID_QUERY',400);
  if(process.env.PRA_NATIONAL_ENABLED!=='1')throw new ApiError('NOT_CONFIGURED',503);
  const grouped=new Map<string,ClimateContextRow[]>();
  // Four dates in flight (four paginated RPC requests concurrently); no annual series sent to client.
  for(let i=0;i<dates.length;i+=4) {
    if(signal?.aborted) throw new ApiError('UPSTREAM_UNAVAILABLE',503);
    const pages=await Promise.all(dates.slice(i,i+4).map(date=>day(date,definition.variable,transport)));
    for(const rows of pages)for(const row of rows){const list=grouped.get(row.pra_id!)??[];list.push(row);grouped.set(row.pra_id!,list);}
  }
  return {period:[start,end],indicator:id,threshold,source_id:'era5-land',dataset_version:NATIONAL.dataset,data:[...grouped.values()].map(rows=>({...aggregate(rows,definition,dates.length,threshold),freshness:`ERA5-Land · source ${end} UTC`}))};
}
export async function readUnified(request:Request) {
  try{return Response.json(await unifiedData(new URL(request.url).searchParams, fetch, request.signal),{headers:{'Cache-Control':'private, max-age=60'}});}
  catch(e){const safe=e instanceof ApiError?e:new ApiError('UPSTREAM_UNAVAILABLE',502);return Response.json({error:safe.code},{status:safe.status,headers:{'Cache-Control':'no-store'}});}
}
