import {describe,it,expect} from 'vitest';
import {modeDate,modeDates,switchMode,temporalMode} from './temporal';
import type {WeatherCycle} from '../operational/model';
const catalogue={run:'2026-11-06T00:00:00Z',available_dates:['2026-11-05','2026-11-06','2026-11-07','2026-11-09','2026-11-13']} as WeatherCycle;
describe('Published temporal modes',()=>{
 it('separates historical/recent/forecast dates and keeps an explicit unavailable URL',()=>{
  expect(modeDates(catalogue,'recent')).toEqual(['2026-11-05','2026-11-06']);
  expect(modeDate(new URLSearchParams(),modeDates(catalogue,'recent'),'recent')).toBe('2026-11-06');
  expect(modeDate(new URLSearchParams('forecast_date=2026-11-08'),modeDates(catalogue,'forecast'),'forecast')).toBe('2026-11-08');
 });
 it('preserves PRA and agricultural context across modes and old opt-in links',()=>{
  const p=new URLSearchParams('experimental=weather&pra=pra:29102&production=cattle&date=2026-10-30');
  expect(temporalMode(p)).toBe('forecast');const q=switchMode(p,'recent');expect(q.get('pra')).toBe('pra:29102');expect(q.get('production')).toBe('cattle');expect(q.get('date')).toBe('2026-10-30');expect(q.has('experimental')).toBe(false);
 });
});
