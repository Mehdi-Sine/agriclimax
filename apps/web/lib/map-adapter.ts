import type { AppContext } from './domain';

export interface MapRiskLayerAdapter {
  kind: 'geojson' | 'vector-tiles';
  getSource(context: AppContext, bounds?: [number, number, number, number]): Promise<unknown>;
}
