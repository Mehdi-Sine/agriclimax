export type AgriculturalScale = 'pra' | 'departement' | 'region';
export type AgriculturalStatus = 'available' | 'partial' | 'unavailable' | 'suppressed' | 'stale';
export interface AgriculturalIndicator {
  id: string; production: string; label: string; variable: string; variable_label: string;
  unit: string; scale: AgriculturalScale; years: number[]; source_id: string;
  sha256: string; unit_note: string; sheet?: string;
}
export interface AgriculturalSeries {
  code: string; name: string; values: (number | null)[]; statuses: AgriculturalStatus[];
  quality_code: string; source_anomalies: Record<string, number>;
}
export interface AgriculturalManifest {
  schema_version: string; rule_version: string; source_id: string; provider: string;
  url: string; page_url: string; license: string | null; published_at: string;
  acquired_at: string; sha256: string; scope: string;
  statistical_status: Record<string, string>; indicators: AgriculturalIndicator[];
  coverage?: string; completed_regions?: string[]; missing_regions?: string[];
  quality_flags?: string[];
}
export interface AgriculturalCatalog { sources: AgriculturalManifest[]; indicators: AgriculturalIndicator[]; source_errors: string[] }
export interface WheatAgriculturalContext {
  year: number; manifest: AgriculturalManifest;
  pra: Record<string, { area_ha: number | null; total_rpg_ha: number; share: number | null; status: AgriculturalStatus }>;
}
export interface PraAgriculturalContext {
  year: number; source: AgriculturalManifest; data: WheatAgriculturalContext['pra'][string] | null;
  distribution: { id: string; label: string; area_ha: number | null; status: AgriculturalStatus }[];
}
export interface AgriculturalDataset {
  indicator: AgriculturalIndicator; rows: AgriculturalSeries[];
}
export function agriculturalValue(series: AgriculturalSeries | undefined, years: number[], year: number) {
  const index = years.indexOf(year);
  if (!series || index < 0) return { value: null, status: 'unavailable' as const };
  return { value: series.values[index] ?? null, status: series.statuses[index] ?? 'unavailable' };
}
