export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical' | 'unavailable';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type ScientificStatus = 'exploratory' | 'documented' | 'expert_reviewed' | 'validated' | 'deprecated';
export type Freshness = 'fresh' | 'stale' | 'unknown';

export interface AppContext {
  productionId: string | null;
  indicatorId: string | null;
  date: string | null;
  territoryId: string | null;
  compareDate: string | null;
}
