export interface WheatWindow {
  start: string; end: string; mode: 'explicit_calendar' | 'supplied_stage';
  stage: string | null; stage_source: string | null;
}
export interface WheatIndicator {
  rule_id: string; rule_version: string; production: 'wheat'; indicator: string;
  period: WheatWindow; value: number | null; unit: string;
  threshold: Record<string, unknown> | null; level: null; confidence: 'low';
  freshness: 'fresh' | 'stale' | 'unknown'; data_freshness: 'fresh' | 'stale' | 'unknown';
  scientific_status: 'exploratory'; scientific_sources: string[]; limits: string[];
  quality_flags: string[]; provenance: Record<string, unknown>[];
  available_days: number; expected_days: number; sequence_count: number | null;
}
export interface WheatPortfolio {
  schema_version: 'wheat-1'; station_id: string; station_name: string;
  latitude: number; longitude: number; spatial_support: 'station_point'; interpolation: 'none';
  production: 'wheat'; risk_computed: false; period: WheatWindow; computed_at: string;
  parameters: { rule_version: string; parameter_set_id: string; gdd_base_c: number;
    heat_threshold_c: number; frost_threshold_c: number; dry_threshold_mm: number;
    spell_min_days: number; max_grid_distance_km:number; parameter_source: string };
  parameter_fingerprint: string; grid_cell: string | null; grid_mapping_source: string | null;
  results: WheatIndicator[];
}
export const INDICATORS: Record<string, string> = {
  gdd: 'Somme de températures / GDD', heat_days: 'Jours de chaleur', heat_spell_max: 'Séquence chaude maximale',
  frost_days: 'Jours de gel', frost_spell_max: 'Séquence de gel maximale', precipitation_sum: 'Cumul de précipitations',
  dry_days: 'Jours sans pluie significative', dry_spell_max: 'Séquence sèche maximale',
  temperature_anomaly: 'Anomalie de température moyenne', precipitation_anomaly: 'Anomalie du cumul de précipitations',
};
export const STAGES: Record<string, string> = { tallage: 'Tallage', montaison: 'Montaison', epiaison: 'Épiaison', anthese: 'Anthèse', remplissage: 'Remplissage' };
