import type { FeatureCollection, Polygon } from 'geojson';
import type { AppContext, ConfidenceLevel, Freshness, RiskLevel } from './domain';

export interface MapProperties {
  cell_id: string;
  valid_date: string;
  production_id: string;
  indicator_id: string;
  risk_level: RiskLevel;
  confidence_level: ConfidenceLevel;
  freshness: Freshness;
  hazard_value?: number | null;
  hazard_unit?: string;
  demo: true;
}
export type DemoMapCollection = FeatureCollection<Polygon, MapProperties> & { agriclimax_demo: true };
export interface DemoData<T> { mode: 'demo'; label: 'Données fictives'; data: T }
export interface RiskRepository {
  getMapFeatures(context: AppContext): Promise<DemoData<DemoMapCollection>>;
}
