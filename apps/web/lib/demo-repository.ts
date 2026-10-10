import fixture from '../../../fixtures/demo-risk.geojson.json';
import type { AppContext } from './domain';
import type { DemoMapCollection, RiskRepository } from './repositories';

const collection: DemoMapCollection = fixture as DemoMapCollection;
export class DemoRiskRepository implements RiskRepository {
  async getMapFeatures(context: AppContext) {
    const data = structuredClone(collection);
    data.features = data.features.filter(({ properties: p }) =>
      (!context.productionId || p.production_id === context.productionId) &&
      (!context.indicatorId || p.indicator_id === context.indicatorId) &&
      (!context.date || p.valid_date === context.date) &&
      (!context.territoryId || p.cell_id === context.territoryId));
    return { mode: 'demo' as const, label: 'Données fictives' as const, data };
  }
}
