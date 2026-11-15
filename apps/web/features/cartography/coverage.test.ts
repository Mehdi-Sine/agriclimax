import {describe, expect, it} from 'vitest';
import {coveragePaint} from './coverage';
import {qualifyCoverage, type CoverageEvidence} from '../climate-quality/policy';
const evidence = (fraction: number): CoverageEvidence => ({fraction, support_id:'cells/period/variable',
  mask:'native_valid_cells', represented_area_m2:null, expected_days:7, available_days:7,
  continuous:true, homogeneous:true, method:'native-test', estimate_certificate:null, reference_compatible:false});
function paint(fraction: number, value: number | null = 0, patch: Partial<CoverageEvidence> = {}, geometrySupportId?: string) {
  const e = {...evidence(fraction), ...patch};
  return coveragePaint({value, field:'value', quality:qualifyCoverage(value,'mean_sum',e), geometrySupportId});
}
describe('COUV-04 cartographic contract', () => {
  it('keeps real zero, uses the exact 90% display boundary and preserves fraction', () => {
    expect(paint(.9)).toMatchObject({target:'whole',fraction:.9,value:0});
    expect(paint(.899999,0,{},'cells/period/variable').target).toBe('covered');
    expect(paint(1).target).toBe('whole');
    expect(paint(0).target).toBe('unavailable');
    expect(paint(1,null).label).toBe('Données indisponibles');
  });
  it('requires the mask of the exact qualified result below 90%', () => {
    expect(paint(.5).reason).toBe('qualified_geometry_unavailable');
    expect(paint(.5,12,{},'other-day').target).toBe('unavailable');
    expect(paint(.5,12,{},'cells/period/variable')).toMatchObject({target:'covered',value:12});
  });
  it('rejects missing days, changing support, invalid fractions and nonfinite values', () => {
    for (const patch of [{available_days:6},{homogeneous:false},{continuous:false},{support_id:null}])
      expect(paint(.95,12,patch).target).toBe('unavailable');
    for (const fraction of [NaN,-1,1.01]) expect(paint(fraction).target).toBe('unavailable');
    expect(paint(1,NaN).target).toBe('unavailable');
  });
  it('does not turn an observed result into a qualified normal or scientific whole-PRA estimate', () => {
    const quality=qualifyCoverage(10,'mean_sum',evidence(.95));
    expect(coveragePaint({value:10,field:'value',quality}).target).toBe('whole');
    expect(coveragePaint({value:10,field:'value',quality:{...quality,indicator_eligible:false}}).target).toBe('unavailable');
    expect(quality.scope).toBe('observed_area');
    expect(quality.journal_eligible).toBe(false);
    expect(coveragePaint({value:10,field:'anomaly',quality}).target).toBe('unavailable');
  });
});
