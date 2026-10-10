import type { AppContext } from './domain';
import type { DemoMapCollection, RiskRepository } from './repositories';

export interface MapRiskLayerAdapter {
  kind: 'geojson' | 'vector-tiles';
  getSource(context: AppContext, bounds?: [number, number, number, number]): Promise<unknown>;
}

export class DemoMapRiskLayerAdapter implements MapRiskLayerAdapter {
  readonly kind = 'geojson' as const;
  constructor(private readonly repository: RiskRepository) {}
  async getSource(context: AppContext): Promise<DemoMapCollection> {
    return (await this.repository.getMapFeatures(context)).data;
  }
}
