import {describe,it,expect} from 'vitest';
import {semanticPalette,classIndex,classLabel,PALETTES} from './registry';
describe('semantic cartography',()=>{
 it('preserves a physical value across periods and unrelated distributions',()=>{
  const p=semanticPalette('rain','mm',7);expect(classIndex(80,p)).toBe(4);
  expect(p.tokens[4]).toBe('--map-rain-5');
  for(const unrelated of [[0,80],[80,1000],[-1,80]]){void unrelated;expect(classIndex(80,semanticPalette('rain','mm',7))).toBe(4);}
 });
 it('centres the anomaly neutral class on zero, with stable symmetric bounds',()=>{
  const p=semanticPalette('temperature','°C',1,'anomaly');
  expect(p.bounds.slice(0,4)).toEqual([-3,-1,1,3]);
  expect(p.tokens[classIndex(-4,p)]).toBe('--map-cool');expect(p.tokens[classIndex(4,p)]).toBe('--map-warm');expect(p.tokens[classIndex(0,p)]).toBe('--map-mid');
  expect(semanticPalette('temperature','°C').id).not.toBe(p.id);
 });
 it('distinguishes deficits, frost, dry durations and agricultural amounts',()=>{
  const deficit=semanticPalette('rain','mm',7,'anomaly');expect(deficit.tokens[classIndex(-60,deficit)]).toContain('dry');
  expect(semanticPalette('frost','jours').tokens[4]).toContain('rain');
  expect(semanticPalette('dry_sequence','jours').tokens[4]).toContain('dry');
  expect(semanticPalette('agriculture','ha').tokens[4]).toContain('agri');
 });
 it('never maps NULL to zero and exposes identical numerical legend definitions',()=>{
  for(const p of PALETTES){expect(classIndex(null,p)).toBe(-1);expect(classIndex(NaN,p)).toBe(-1);expect(classIndex(0,p)).toBeGreaterThanOrEqual(0);expect(p.bounds).toHaveLength(p.tokens.length);expect(classLabel(p,4)).toContain('>');expect(p.documentation).toContain(p.id);}
 });
});
