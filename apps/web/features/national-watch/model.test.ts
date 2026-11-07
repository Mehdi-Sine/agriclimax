import {describe,it,expect} from 'vitest';
import {detectNational,watchFreshness,type Place} from './model';
import type {WeatherRow,WeatherVariable} from '../operational/model';
const places:Place[]=[{id:'pra:00001',name:'A',region:'R1'},{id:'pra:00002',name:'B',region:'R2'}];
function fixture():WeatherRow[]{return places.flatMap(p=>Array.from({length:7},(_,i)=>{
 const date=`2026-07-0${i+1}`;
 return (['temperature','temperature_max','temperature_min','precipitation','humidity'] as WeatherVariable[]).map(variable=>({pra_id:p.id,valid_date:date,variable,value:variable==='temperature_max'?32:variable==='temperature_min'?-2:variable==='temperature'?30:variable==='humidity'?80:i===6?30:0,status:'available',spatial_coverage:1,temporal_coverage:1,source_id:'test-fixture',model_run_at:'2026-06-30T00:00:00Z',nature:'forecast',data_freshness:'fresh',provenance:{checksum:'fixture-only'},provenance_sha256:'fixture-only',quality_flags:[]} as unknown as WeatherRow));
})).flat();}
describe('national selection: explicitly synthetic unit inputs',()=>{
 it('reuses scientific thresholds, denominators, regional membership and independent peaks',()=>{
  const result=detectNational(fixture(),places,'2026-07-01','2026-07-07');
  expect(result.metrics).toHaveLength(10);expect(result.events).toHaveLength(10);
  expect(result.metrics.find(m=>m.phenomenon==='heat')?.value).toBe(32);
  expect(result.metrics.find(m=>m.phenomenon==='dry')?.value).toBe(6);
  expect(result.metrics.find(m=>m.phenomenon==='frost')?.value).toBe(-2);
  expect(result.metrics.find(m=>m.phenomenon==='rain')?.value).toBe(30);
  expect(result.events.every(e=>e.evaluated===1&&e.pra_ids.length===1)).toBe(true);
  expect(result.events.find(e=>e.region==='R1')?.pra_ids).toEqual(['pra:00001']);
 });
 it('is deterministic and rejects duplicates instead of double counting',()=>{
  const rows=fixture(),a=detectNational(rows,places,'2026-07-01','2026-07-07');
  expect(detectNational([...rows].reverse(),places,'2026-07-01','2026-07-07')).toEqual(a);
  expect(()=>detectNational([...rows,rows[0]],places,'2026-07-01','2026-07-07')).toThrow('DUPLICATE');
 });
 it('keeps missing humidity, partial support, and no crossing distinct',()=>{
  const rows=fixture().map(r=>r.variable==='humidity'?{...r,value:null}:r.variable==='temperature_max'?{...r,value:20}:r.pra_id==='pra:00002'&&r.variable==='precipitation'?{...r,status:'partial' as const,value:null}:r);
  const result=detectNational(rows,places,'2026-07-01','2026-07-07');
  expect(result.metrics.find(m=>m.phenomenon==='heat')?.state).toBe('no_threshold_crossing');
  expect(result.metrics.find(m=>m.phenomenon==='thi')?.value).toBeNull();
  expect(result.metrics.find(m=>m.pra==='pra:00002'&&m.phenomenon==='dry')?.detected).toBeNull();
 });
 it('never bridges a dry sequence across different sources or runs',()=>{
  const rows=fixture().map(r=>r.valid_date>='2026-07-04'?{...r,source_id:'other-fixture'}:r);
  const m=detectNational(rows,places,'2026-07-01','2026-07-07').metrics.find(m=>m.phenomenon==='dry');
  expect(m?.value).toBe(3);expect(m?.quality_flags).toContain('source_run_boundaries_sequences_not_joined');
 });
 it('marks old and expired cycles using consultation time, independently of signals',()=>{
  expect(watchFreshness({run:'2026-07-01T00:00:00Z',acquired_at:'2026-07-01T10:00:00Z',period:['2026-07-02','2026-07-08']},Date.parse('2026-07-20'))).toEqual({stale:true,expired:true});
 });
});
