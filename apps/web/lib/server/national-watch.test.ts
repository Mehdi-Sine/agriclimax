import {beforeEach,describe,it,expect,vi} from 'vitest';
import type {NationalWeatherDocument} from './weather-archives';
import type {WeatherRow,WeatherVariable} from '../../features/operational/model';
vi.mock('server-only',()=>({}));
const {weather}=vi.hoisted(()=>({weather:vi.fn()}));
vi.mock('./weather-archives',()=>({nationalWeatherDocument:weather}));
vi.mock('./agriculture-index',()=>({sources:[{source_id:'rpg-fixture',sha256:'fixture-version'}],datasets:Object.fromEntries([1,2,18,19,20,21].map(g=>[`rpg-group-${g}-surf-pra`,async()=>({indicator:{source_id:'fixture-rpg',years:[2025]},rows:[{code:'01195',values:[1],statuses:['available']}]})]))}));
import {nationalWatch} from './national-watch';
import {GET} from '../../app/api/veille/route';
function fixture(archive:string,run:string):NationalWeatherDocument{
 const root=Date.parse(run),rows=Array.from({length:7},(_,i)=>(['temperature','temperature_min','temperature_max','precipitation','humidity'] as WeatherVariable[]).map(variable=>({pra_id:'pra:01195',valid_date:new Date(root+(i+1)*86400000).toISOString().slice(0,10),variable,value:variable==='humidity'?50:variable==='precipitation'?0:10,status:'available',spatial_coverage:1,temporal_coverage:1,source_id:'fixture-only',model_run_at:run,nature:'forecast',data_freshness:'fresh',quality_flags:[],provenance:{checksum:'fixture-only'},provenance_sha256:'fixture-only',published_at:null} as unknown as WeatherRow))).flat();
 return {archive_sha256:archive,run,rows,selected_indices:rows.map((_,i)=>i),acquired_at:run,pra_count:713,attribution:'Synthetic unit fixture',recent_estimate_status:'unavailable'};
}
beforeEach(()=>weather.mockReset());
describe('national watch source/version boundaries (synthetic unit fixtures)',()=>{
 it('reuses a synthesis for one immutable archive and invalidates it on the next source identity',async()=>{
  weather.mockResolvedValue(fixture('cache-fixture-a','2026-07-01T00:00:00Z'));
  const first=await nationalWatch(),second=await nationalWatch();expect(second).toBe(first);
  expect(first.coverage.find(c=>c.phenomenon==='heat')).toMatchObject({evaluated:1,affected:0,unavailable:712});
  weather.mockResolvedValue(fixture('cache-fixture-b','2026-07-02T00:00:00Z'));
  const next=await nationalWatch();expect(next.identity).not.toBe(first.identity);expect(next.period[0]).toBe('2026-07-03');
 });
 it('fails explicitly without a verified national source and never falls back to pilot/demo data',async()=>{
  weather.mockResolvedValue(null);const response=await GET(new Request('http://localhost/api/veille'));
  expect(response.status).toBe(503);expect(await response.json()).toEqual({error:'VERIFIED_NATIONAL_WATCH_UNAVAILABLE'});
 });
 it('rejects repeated, unknown and malformed archival queries before reading data',async()=>{
  for(const query of ['run=','run=2026-02-30','run=x','run=2026-07-01&run=2026-07-02','other=1'])expect((await GET(new Request('http://localhost/api/veille?'+query))).status).toBe(400);
  expect(weather).not.toHaveBeenCalled();
 });
 it('passes an explicit archived cycle through to the verified archive reader',async()=>{
  weather.mockResolvedValue(fixture('archived-fixture','2026-07-01T00:00:00Z'));
  const response=await GET(new Request('http://localhost/api/veille?run=2026-07-01'));expect(response.status).toBe(200);expect(weather).toHaveBeenCalledWith('2026-07-01');
 });
});
