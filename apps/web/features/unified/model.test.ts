import { expect, it } from 'vitest';
import { aggregate, INDICATORS, parseState } from './model';
import type { ClimateContextRow } from '../national/model';
const row=(value:number|null,normal:number|null=10):ClimateContextRow=>({pra_id:'pra:01451',current_value:value,normal_1991_2020:normal,anomaly:value===null?null:value-10,sample_years:30,expected_years:30,reference_coverage:1,current_coverage:value===null?0:1,current_status:value===null?'unavailable':'available',status:value===null?'missing_current':'available',normal_status:'available'});
it('sums rain, means temperature, and compares only homologous complete dates',()=>{
  const rows=[row(12),row(18)];
  expect(aggregate(rows,INDICATORS[0],2,25)).toMatchObject({value:15,normal:10,anomaly:5,status:'available'});
  expect(aggregate(rows,INDICATORS[3],2,25)).toMatchObject({value:30,normal:20,anomaly:10});
});
it('preserves partial sums and absence, never interprets missing days as zero',()=>{
  expect(aggregate([row(12),row(null)],INDICATORS[3],2,25)).toMatchObject({value:12,normal:null,anomaly:null,status:'partial',observedDays:1,expectedDays:2,coverage:0.5});
  expect(aggregate([row(null)],INDICATORS[3],1,25)).toMatchObject({value:null,status:'unavailable'});
  expect(aggregate([{...row(12),current_coverage:0.5,current_status:'partial'}],INDICATORS[0],1,25).status).toBe('partial');
});
it('uses strict thresholds and never constructs a derived normal from daily mean normals',()=>{
  expect(aggregate([row(25),row(26),row(null)],INDICATORS[4],3,25)).toMatchObject({value:1,normal:null,anomaly:null,status:'partial'});
  expect(aggregate([row(0),row(-1)],INDICATORS[5],2,0).value).toBe(1);
  expect(aggregate([row(4),row(12)],INDICATORS[6],2,5)).toMatchObject({value:7,normal:null,anomaly:null});
});
it('reports invalid deep links instead of silently coercing dates, thresholds or modes',()=>{
  for(const q of ['date=2026-11-03','start=2026-10-18&date=2026-09-19','seuil=NaN','indicateur=hot&mode=anomaly','pra=station:12','date=2026-10-15&date=2026-10-16','production=unknown','periode=year'])expect(parseState(new URLSearchParams(q),'climat').errors.length).toBeGreaterThan(0);
  expect(parseState(new URLSearchParams('pra=pra:01451&date=2026-10-15'),'climat')).toMatchObject({errors:[],state:{pra:'pra:01451',date:'2026-10-15',indicator:'temperature',mode:'value'}});
});
