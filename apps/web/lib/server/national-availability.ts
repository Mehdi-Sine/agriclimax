import 'server-only';
import { NATIONAL, DAYS } from '../../features/national/model';
import { calendarDays, isCalendarDate, type NationalAvailability } from '../../features/national/daily-availability';
import { ApiError } from './query';
import {archiveCatalogue,currentManifest} from './weather-archives';

let cached: { expires: number; promise: Promise<NationalAvailability> } | undefined;

async function discover(transport: typeof fetch): Promise<NationalAvailability> {
  const base=process.env.NEXT_PUBLIC_SUPABASE_URL, secret=process.env.SUPABASE_SECRET_KEY;
  if(!base||!secret) throw new ApiError('NOT_CONFIGURED',503);
  let url:URL;
  try {
    url=new URL(base);
    if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error();
    url.pathname='/rest/v1/rpc/agriclimax_pra_daily_catalog';
  } catch {throw new ApiError('NOT_CONFIGURED',503);}
  let raw:Record<string,unknown>;
  try {
    const response=await transport(url,{method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000),headers:{apikey:secret,'Content-Type':'application/json'},body:JSON.stringify({p_reference:NATIONAL.reference,p_dataset:NATIONAL.dataset})});
    if(!response.ok)throw new ApiError('UPSTREAM_UNAVAILABLE',502);
    const text=await response.text();
    if(text.length>12000)throw new ApiError('INVALID_RESPONSE',502);
    const value:unknown=JSON.parse(text);
    if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError('INVALID_RESPONSE',502);
    raw=value as Record<string,unknown>;
  }catch(error){throw error instanceof ApiError?error:new ApiError('UPSTREAM_UNAVAILABLE',502);}
  const date=raw.latest;
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||calendarDays(date,date).length!==1||date<NATIONAL.end||raw.source_id!=='era5-land'||raw.dataset_version!==NATIONAL.dataset||raw.source_date!==date)throw new ApiError('INVALID_RESPONSE',502);
  const days=raw.days;
  if(!Array.isArray(days)||days.length!==30||!days.every(d=>typeof d==='string')||days.join(',')!==calendarDays(days[0],date).join(','))throw new ApiError('INVALID_RESPONSE',502);
  for(const field of ['acquired_at','updated_at'] as const)if(!(raw[field]===null||typeof raw[field]==='string'&&Number.isFinite(Date.parse(raw[field] as string))))throw new ApiError('INVALID_RESPONSE',502);
  if(!['known','unknown'].includes(String(raw.acquisition_time_status))||(raw.acquisition_time_status==='known')!==(raw.acquired_at!==null))throw new ApiError('INVALID_RESPONSE',502);
  const current=transport===fetch?await currentManifest():null;
  const cold=transport===fetch&&!current?await archiveCatalogue():null;
  const extra=current?.era5_dates??cold?.era5.flatMap(entry=>entry.dates)??[];
  const all=[...new Set([...DAYS,...days as string[],...extra])].sort(),latest=all.at(-1)!;
  const warmLatest=latest===date;
  return {source_id:'era5-land',dataset_version:NATIONAL.dataset,latest,source_date:latest,
    days:all,
    acquired_at:warmLatest?raw.acquired_at as string|null:null,updated_at:warmLatest?raw.updated_at as string|null:null,
    acquisition_time_status:warmLatest?raw.acquisition_time_status as 'known'|'unknown':'unknown',
    freshness:Date.now()-Date.parse(latest)>6*86400000?'stale':'recent_reanalysis'};
}

export function nationalAvailability(transport:typeof fetch=fetch):Promise<NationalAvailability> {
  if(process.env.PRA_NATIONAL_ENABLED!=='1')throw new ApiError('NOT_CONFIGURED',503);
  if(transport!==fetch)return discover(transport);
  if(cached&&cached.expires>Date.now())return cached.promise;
  const promise=discover(transport);
  cached={expires:Date.now()+60000,promise};
  void promise.catch(()=>{if(cached?.promise===promise)cached=undefined;});
  return promise;
}
export async function nationalDays(transport:typeof fetch, requested:string[]=[]):Promise<string[]> {
  if(requested.some(d=>!isCalendarDate(d)))return DAYS;
  const today=new Date().toISOString().slice(0,10);
  // Legacy dates keep their existing bounded reader; future days still require catalog proof.
  if(requested.length&&requested.every(d=>DAYS.includes(d)||d<NATIONAL.start||d>today))return DAYS;
  return (await nationalAvailability(transport)).days;
}
