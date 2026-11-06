import { describe, it, expect } from 'vitest';
import { RULES } from './catalogue';
import { calculate, type InputDay } from './calculate';
const rule=(id:string)=>RULES.find(r=>r.id===id)!;
const day=(date:string,t:number|null,rh:number|null=50):InputDay=>({pra:'pra:28341',date,values:{temperature:t,temperature_min:t,temperature_max:t,humidity:rh,precipitation:t},compatible:true,complete:true,source:'reference',run:'2026-12-30T00:00:00Z',nature:'forecast',freshness:'fresh',provenance:['golden'],quality_flags:[]});
const evalRows=(id:string,rows:InputDay[],threshold=rule(id).threshold)=>calculate('pra:28341',rows,'2026-12-31','2027-01-02',rule(id),threshold);
describe('shared national agroclimatic calculator',()=>{
 it('computes explicit-base GDD across the year without inferring phenology',()=>{expect(evalRows('gdd',[day('2026-12-31',-1),day('2027-01-01',4),day('2027-01-02',8)],2)).toMatchObject({value:8,status:'available',rule_version:'agroclimatic-1.0.0'});});
 it('uses strict thresholds, counts episodes and longest sequences',()=>{const rows=[day('2026-12-31',25),day('2027-01-01',26),day('2027-01-02',27)];expect(evalRows('hot',rows)).toMatchObject({value:2,episodes:1,longest:2});expect(evalRows('hot_sequence',rows).value).toBe(2);});
 it('refuses incomplete totals and preserves NULL on a missing day',()=>{const r=evalRows('rain',[day('2026-12-31',10),day('2027-01-02',20)]);expect(r).toMatchObject({value:null,status:'partial',observedDays:2,reason:'incomplete_period',episodes:null});expect(r.series[1].value).toBeNull();});
 it('distinguishes zero rainfall and unavailable rainfall; validates physics',()=>{expect(evalRows('rain',[day('2026-12-31',0),day('2027-01-01',0),day('2027-01-02',0)]).value).toBe(0);expect(evalRows('rain',[day('2026-12-31',-1),day('2027-01-01',0),day('2027-01-02',0)]).value).toBeNull();});
 it('computes the existing THI variant and refuses absent or invalid RH',()=>{const rows=[day('2026-12-31',30,50),day('2027-01-01',30,50),day('2027-01-02',30,50)];expect(evalRows('thi',rows).value).toBeCloseTo(78.3,8);rows[1].values.humidity=null;expect(evalRows('thi',rows).value).toBeNull();rows[1].values.humidity=101;expect(evalRows('thi',rows).value).toBeNull();});
 it('rejects different runs without hiding daily values',()=>{const rows=[day('2026-12-31',30),day('2027-01-01',30),day('2027-01-02',30)];rows[1].run='2026-12-31T00:00:00Z';const r=evalRows('hot',rows);expect(r.reason).toBe('incompatible_sources_or_runs');expect(r.value).toBeNull();expect(r.series.every(s=>s.value===30)).toBe(true);});
 it('rejects partial coastal supports, duplicate dates and nonfinite inputs',()=>{const row=day('2026-12-31',30);row.complete=false;expect(evalRows('hot',[row]).value).toBeNull();expect(()=>evalRows('hot',[row,row])).toThrow('DUPLICATE_DAY');expect(()=>evalRows('hot',[],NaN)).toThrow();});
 it('requires metadata on every rule',()=>{for(const r of RULES){expect(r.source).toMatch(/^https:/);expect(r.formula).toBeTruthy();expect(r.unavailable).toContain('NULL');expect(r.scientific_status).toBe('exploratory');}});
});
