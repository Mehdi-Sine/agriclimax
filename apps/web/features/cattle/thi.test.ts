import { describe, expect, it } from 'vitest';
import { evaluateThi, thi, cattleRule, type Sample } from './thi';
const start = '2026-07-01T00:00:00Z';
function rows(n = 24): Sample[] { return Array.from({length:n}, (_,i) => ({at: new Date(Date.parse(start)+i*3600000).toISOString(), temperature_c:30, humidity_pct:50})); }
function calc(samples: Sample[], days=1, resolution: 'hourly'|'daily'='hourly') { return evaluateThi(samples, {start, end:new Date(Date.parse(start)+days*86400000).toISOString(), resolution, freshness:'fresh', provenance:[]}); }
describe('cattle climatic exposure', () => {
  it('matches manual THI, hourly mean/max, dose and continuous episode', () => {
    expect(thi(30,50)).toBeCloseTo(78.3);
    const r=calc(rows()); expect(r.daily[0].thi_mean).toBeCloseTo(78.3); expect(r.daily[0].thi_max).toBeCloseTo(78.3);
    expect(r.metrics[0]).toMatchObject({count:24, episodes:1, max_episode_duration:24});
    expect(r.metrics[0].cumulative_exposure).toBeCloseTo(151.2);
  });
  it('excludes equality from exceedance but includes lower bound in class', () => {
    const r=evaluateThi(rows(), {start,end:'2026-07-02T00:00:00Z',resolution:'hourly',freshness:'fresh',provenance:[],rule:{...cattleRule,thresholds:[78.3],classes:[{minimum:78.3,level:'reference'}]}});
    expect(r.metrics[0].count).toBe(0); expect(r.level).toBe('reference');
  });
  it('breaks episodes at missing hours and withholds daily maxima', () => {
    const samples=rows(); samples.splice(10,1); const r=calc(samples);
    expect(r.status).toBe('insufficient'); expect(r.metrics[0]).toMatchObject({episodes:2,max_episode_duration:13}); expect(r.daily[0].thi_max).toBeNull();
  });
  it('requires complete nights and a strictly lower sample for recovery', () => {
    const samples=rows(48); expect(calc(samples,2).night_recovery.nights_without_recovery).toBe(1);
    samples[24].temperature_c=15; expect(calc(samples,2).night_recovery.nights_without_recovery).toBe(0);
    samples.splice(24,1); expect(calc(samples,2).night_recovery.nights_without_recovery).toBeNull();
  });
  it('never computes THI without humidity', () => { const r=calc(rows().map(r=>({...r,humidity_pct:null}))); expect(r).toMatchObject({status:'unavailable',value:null,reason:'humidity_missing'}); expect(r.metrics[0].count).toBeNull(); });
  it('does not call synthetic daily THI an hourly mean/max', () => { const r=calc(rows(1),1,'daily'); expect(r.daily[0]).toMatchObject({thi_mean:null,thi_max:null,thi_synthetic:78.3}); expect(r.night_recovery.status).toBe('unavailable'); });
  it('rejects malformed input and variants', () => { expect(()=>thi(30,101)).toThrow(); expect(()=>thi(30,50,'unknown')).toThrow(); expect(()=>calc([...rows(),...rows(1)])).toThrow(); });
});

import golden from '../../../../fixtures/cattle/python-web-golden.json';
for (const example of golden) it(`matches Python reference including DST: ${example.name}`, () => {
  const result= evaluateThi(example.samples,{start:example.start,end:example.end,resolution:'hourly',freshness:'fresh',provenance:[]});
  expect(result).toMatchObject(example.expected);
});
