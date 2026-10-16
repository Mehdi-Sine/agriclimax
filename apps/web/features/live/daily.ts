import 'server-only';
import { ApiError } from '../../lib/server/query';
import { validatePortfolios, wheatQuery } from '../wheat/server';
import type { WheatPortfolio } from '../wheat/model';
import type { ThiResult } from '../cattle/thi';

export type DailyPublication = { key:string; start:string; end:string; computed_at:string; wheat:WheatPortfolio[]; cattle:(ThiResult & {station_id:string})[] };
const record = (v:unknown):v is Record<string,unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const strings = (v:unknown):v is string[] => Array.isArray(v) && v.every(x=>typeof x==='string');
const nullableNumber = (v:unknown) => v === null || typeof v === 'number' && Number.isFinite(v);
function invalid():never { throw new ApiError('INVALID_RESPONSE',502); }
function cattleResult(raw:unknown, start:string, end:string):ThiResult & {station_id:string} {
  if (!record(raw) || typeof raw.station_id !== 'string' || !/^\d{8}$/.test(raw.station_id)
    || raw.production !== 'cattle' || raw.rule_id !== 'cattle.thi.exposure' || typeof raw.rule_version !== 'string'
    || raw.resolution !== 'daily' || raw.unit !== 'THI' || !nullableNumber(raw.value)
    || !['available','insufficient','unavailable'].includes(String(raw.status))
    || !['fresh','stale','unknown'].includes(String(raw.data_freshness))
    || !['exploratory','reviewed','validated'].includes(String(raw.scientific_status))
    || typeof raw.formula !== 'string' || typeof raw.notice !== 'string'
    || !strings(raw.quality_flags) || !strings(raw.limits) || !Array.isArray(raw.provenance)
    || raw.provenance.some(p=>!record(p) || p.demo !== false || typeof p.source_id !== 'string' || typeof p.retrieved_at !== 'string')
    || !record(raw.period) || Date.parse(String(raw.period.start)) !== Date.parse(start)
    || Date.parse(String(raw.period.end_exclusive)) !== Date.parse(end)+86400000
    || !record(raw.confidence) || typeof raw.confidence.coverage !== 'number' || raw.confidence.coverage < 0 || raw.confidence.coverage > 1
    || !record(raw.scientific_source) || typeof raw.scientific_source.url !== 'string' || typeof raw.scientific_source.title !== 'string'
    || !Array.isArray(raw.daily) || raw.daily.length !== (Date.parse(end)-Date.parse(start))/86400000+1
    || raw.daily.some((d,i)=>!record(d) || d.date !== new Date(Date.parse(start)+i*86400000).toISOString().slice(0,10)
      || !nullableNumber(d.thi_synthetic) || !nullableNumber(d.thi_mean) || !nullableNumber(d.thi_max) || typeof d.coverage !== 'number' || d.coverage < 0 || d.coverage > 1)
    || !Array.isArray(raw.metrics) || !raw.metrics.length
    || raw.metrics.some(m=>!record(m) || typeof m.threshold !== 'number' || typeof m.partial !== 'boolean' || m.unit !== 'd'
      || ![m.days_above,m.episodes,m.max_episode_duration].every(nullableNumber))) invalid();
  // Guard above validates every field consumed by the live UI. No recalculation.
  return raw as unknown as ThiResult & {station_id:string};
}
export function validateDaily(raw:unknown):DailyPublication|null {
  if (raw === null) return null;
  if (!record(raw) || typeof raw.content_key !== 'string' || !/^[a-f0-9]{64}$/.test(raw.content_key) || !record(raw.payload)) invalid();
  const p=raw.payload;
  if (p.schema_version !== 'daily-1' || typeof p.from !== 'string' || typeof p.to !== 'string'
    || typeof p.computed_at !== 'string' || !Number.isFinite(Date.parse(p.computed_at)) || !/(Z|[+-]\d{2}:\d{2})$/.test(p.computed_at)
    || Date.parse(p.computed_at)>Date.now()+300000 || !Array.isArray(p.wheat) || !p.wheat.length || p.wheat.length>10
    || !Array.isArray(p.cattle) || p.cattle.length!==p.wheat.length) invalid();
  const query=wheatQuery(new URLSearchParams({mode:'wheat',start:p.from,end:p.to}));
  if (Date.parse(p.to)-Date.parse(p.from)>6*86400000) invalid();
  const wheat=validatePortfolios(p.wheat,query);
  if(wheat.some(w=>w.results.some(r=>!r.provenance.length || r.provenance.some(p=>!record(p) || p.demo!==false)))) invalid();
  const cattle=p.cattle.map(c=>cattleResult(c,p.from as string,p.to as string));
  if (new Set(cattle.map(c=>c.station_id)).size!==wheat.length || wheat.some(w=>!cattle.some(c=>c.station_id===w.station_id) || Date.parse(w.computed_at)!==Date.parse(p.computed_at as string))) invalid();
  const stale=Date.now()-Date.parse(`${p.to}T00:00:00Z`)>48*3600000;
  return {key:raw.content_key,start:p.from,end:p.to,computed_at:p.computed_at,wheat,
    cattle:cattle.map(c=>({...c,freshness:stale?'stale':c.data_freshness,data_freshness:stale?'stale':c.data_freshness}))};
}
export class DailyRepository {
  async read(start:string|null=null,end:string|null=null):Promise<{latest:DailyPublication|null; selected:DailyPublication|null}> {
    // Resolve the server URL at request time, including when promoting a build.
    const base=Reflect.get(process.env,'NEXT_PUBLIC_SUPABASE_URL') as string|undefined;
    const key=process.env.SUPABASE_SECRET_KEY;
    if (!base || !key) throw new ApiError('NOT_CONFIGURED',503);
    const url=new URL(base);
    if (url.protocol!=='https:' || url.username || url.password || url.search || url.hash || url.pathname!=='/') throw new ApiError('NOT_CONFIGURED',503);
    url.pathname='/rest/v1/rpc/agriclimax_read_daily';
    const response=await fetch(url,{method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000),
      headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({p_start:start,p_end:end})});
    if (!response.ok) throw new ApiError('UPSTREAM_UNAVAILABLE',502);
    const text=await response.text();
    if(text.length>16_100_000) invalid();
    const raw:unknown=JSON.parse(text);
    if(!record(raw)) invalid();
    const latest=validateDaily(raw.latest), selected=validateDaily(raw.selected);
    if(selected && start!==null && (selected.start!==start || selected.end!==end)) invalid();
    if(selected && !latest) invalid();
    if(start===null && selected?.key!==latest?.key) invalid();
    return {latest,selected};
  }
}
