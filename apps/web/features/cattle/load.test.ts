import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { loadCattle } from './load';
import { SupabaseStationWeatherRepository, type StationBatch } from '../../lib/server/station-weather';
const provenance = {source_id:'meteofrance-climatology',retrieved_at:'2026-10-15T12:00:00Z',published_at:null,checksum:'a'.repeat(64),demo:false as const,normalizer_version:'1',publication_time_known:false as const};
function batch(humidity: number|null=50): StationBatch & {retrieval_freshness: string; publication_freshness: 'unknown'} {
  return {retrieval_freshness:'fresh',publication_freshness:'unknown',schema_version:'internal-1',source_id:provenance.source_id,valid_date:'2026-07-01',status:'partial',freshness:'stale',issues:[],provenance,
    observations:[['temperature',30,'degC'],['humidity',humidity,'%']].map(([variable,value,unit]) => ({cell_id:'29075001',variable:variable as string,value:value as number|null,unit:unit as string,
      observed_at:'2026-07-01T00:00:00Z',source_timezone:'UTC',source_unit:unit as string,source_field:null,source_checksum:null,temporal_resolution:'daily',quality_flags:[],provenance}))};
}
function repo(humidity: number|null=50) {
  const r=new SupabaseStationWeatherRepository();
  vi.spyOn(r,'stations').mockResolvedValue([]);
  vi.spyOn(r,'series').mockImplementation(async q=>q.p_source==='meteofrance-climatology'?[batch(humidity)]:[]);
  return r;
}
const params=()=>new URLSearchParams({start:'2026-07-01',end:'2026-07-01',station:'29075001'});
it('uses daily synthetic when persisted hourly coverage is absent, with explicit flag and stale state',async()=>{
  const r=await loadCattle(params(),repo()); expect(r.results[0]).toMatchObject({resolution:'daily',value:78.3,freshness:'stale'});
  expect(r.results[0].quality_flags).toContain('hourly_coverage_incomplete_daily_synthetic_used');
});
it('returns unavailable when daily humidity is absent',async()=>{
  const r=await loadCattle(params(),repo(null)); expect(r.results[0]).toMatchObject({status:'unavailable',value:null,reason:'humidity_missing'});
});
it('rejects invalid date and excessive periods through Task11 query validation',async()=>{
  const p=params();p.set('start','2020-02-30'); const r=await loadCattle(p,repo()); expect(r.state).toBe('error');
});
it('uses complete hourly series when available',async()=>{
  const r=repo(); const daily=batch();
  const hourly={...daily,source_id:'meteofrance-observations',provenance:{...provenance,source_id:'meteofrance-observations'},observations:Array.from({length:24},(_,h)=>daily.observations.map(row=>({...row,observed_at:`2026-07-01T${String(h).padStart(2,'0')}:00:00Z`,temporal_resolution:'hourly',provenance:{...row.provenance,source_id:'meteofrance-observations'}}))).flat()};
  vi.spyOn(r,'series').mockImplementation(async q=>q.p_source==='meteofrance-observations'?[hourly]:[daily]);
  const result=await loadCattle(params(),r);expect(result.results[0]).toMatchObject({resolution:'hourly',status:'available'});
});
