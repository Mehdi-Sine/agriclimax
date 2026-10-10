import { describe, expect, it } from 'vitest';
import { parseContext, serializeContext } from './url-state';
import { DemoRiskRepository } from './demo-repository';
import { DemoMapRiskLayerAdapter } from './map-adapter';

describe('shared URL context', () => {
  it('round trips a canonical context across spaces', () => {
    const input = new URLSearchParams('territory=demo-001&date=2026-07-01&production=wheat_soft&indicator=tmax_days_above&compare=2026-06-30');
    const context = parseContext(input);
    expect(parseContext(serializeContext(context))).toEqual(context);
    expect(serializeContext(context).toString()).toBe('production=wheat_soft&indicator=tmax_days_above&date=2026-07-01&territory=demo-001&compare=2026-06-30');
  });
  it('rejects impossible dates and unsafe identifiers', () => {
    expect(parseContext(new URLSearchParams('date=2026-02-30&compare=oops&territory=%3Cscript%3E')).date).toBeNull();
    expect(parseContext(new URLSearchParams('territory=%3Cscript%3E')).territoryId).toBeNull();
  });
});

describe('local demo repository', () => {
  it('labels data, filters context and isolates caller mutations', async () => {
    const repo = new DemoRiskRepository();
    const context = parseContext(new URLSearchParams());
    const result = await repo.getMapFeatures(context);
    expect(result.label).toBe('Données fictives');
    expect(result.data.features[0].properties.demo).toBe(true);
    result.data.features.length = 0;
    expect((await new DemoMapRiskLayerAdapter(repo).getSource(context)).features).toHaveLength(1);
    expect((await repo.getMapFeatures({...context, productionId: 'dairy_cattle'})).data.features).toHaveLength(0);
  });
});
