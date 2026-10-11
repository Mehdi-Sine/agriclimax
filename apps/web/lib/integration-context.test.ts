import { describe, expect, it } from 'vitest';
import { observationHref, sharedContext } from './integration-context';

describe('cross-space navigation', () => {
  it('restores the exact diagnostic cell even without a territory in a direct link', () => {
    const params = new URLSearchParams('mode=live&cell=cell-42&territory=other&production=wheat_soft&indicator=tmax_days_above&date=2026-07-01&rule=heat&version=1.0&compare=2026-06-30&bbox=0,40,10,50&zoom=5.20&start=2026-06-01&end=2026-07-01');
    const restored = new URL(observationHref(params), 'http://localhost').searchParams;
    expect(restored.get('territory')).toBe('cell-42');
    for (const key of ['mode', 'production', 'indicator', 'date', 'rule', 'version', 'compare', 'bbox', 'zoom']) expect(restored.get(key)).toBe(params.get(key));
    expect(restored.has('start')).toBe(false);
    expect(restored.has('cell')).toBe(false);
  });
  it('preserves current map selection and camera across navigation without leaking local watch filters', () => {
    const params = new URLSearchParams('mode=demo&territory=demo-001&rule=demo_heat_wheat&version=1.0&bbox=-5,41,10,51&zoom=6&signal=local&density=detailed&risk=high');
    const next = sharedContext(params);
    for (const key of ['mode', 'territory', 'rule', 'version', 'bbox', 'zoom']) expect(next.get(key)).toBe(params.get(key));
    for (const key of ['signal', 'density', 'risk']) expect(next.has(key)).toBe(false);
  });
  it('keeps dotted identifiers accepted by the existing API query parser', () => {
    const params = new URLSearchParams('cell=grid.42&production=wheat.v1&indicator=heat.v1&rule=heat.rule&version=1.0&mode=live');
    const restored = new URL(observationHref(params), 'http://localhost').searchParams;
    expect(sharedContext(restored).get('territory')).toBe('grid.42');
    expect(sharedContext(restored).get('production')).toBe('wheat.v1');
    expect(sharedContext(restored).get('indicator')).toBe('heat.v1');
  });
});
