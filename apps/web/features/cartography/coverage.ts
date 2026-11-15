import type { CoverageQuality } from '../climate-quality/policy';

export const CARTOGRAPHIC_COVERAGE_VERSION = 'couv04-1';
// A build-time switch, deliberately independent of acquisition and qualification.
export const EXHAUSTIVE_COVERAGE = process.env.NEXT_PUBLIC_COUV04_RENDER_ENABLED === 'true';
export interface CoverageReading {
  value: number | null;
  quality?: CoverageQuality;
  field: 'value' | 'normal' | 'anomaly';
  /** Identity of the geometry supplied for this exact result, never a generic land mask. */
  geometrySupportId?: string;
}
export interface CoveragePaint {
  version: typeof CARTOGRAPHIC_COVERAGE_VERSION;
  target: 'whole' | 'covered' | 'unavailable';
  fraction: number | null;
  value: number | null;
  label: string;
  reason: string;
}
/** Presentation only: never changes a scientific value, source or eligibility. */
export function coveragePaint(input: CoverageReading): CoveragePaint {
  const q = input.quality, e = q?.evidence;
  const fraction = e?.fraction ?? null;
  const missing = (reason: string): CoveragePaint => ({version: CARTOGRAPHIC_COVERAGE_VERSION,
    target: 'unavailable', fraction, value: null, label: 'Données indisponibles', reason});
  if (input.value === null || !Number.isFinite(input.value)) return missing('value_unavailable');
  if (!q || !e || !e.support_id || !e.method || fraction === null || !Number.isFinite(fraction) || fraction <= 0 || fraction > 1.0001)
    return missing('missing_support_metadata');
  if (!q.indicator_eligible || !q.numeric_value) return missing('result_not_eligible');
  if (!['native_complete', 'qualified_estimate', 'observed_partial'].includes(q.state)) return missing(q.reason ?? 'unqualified_result');
  if (!Number.isInteger(e.expected_days) || e.expected_days <= 0 || e.available_days !== e.expected_days || !e.continuous || !e.homogeneous)
    return missing('incomplete_or_incompatible_period');
  if (input.field !== 'value' && (!e.reference_compatible || q.state === 'observed_partial')) return missing('incompatible_reference');
  // 90% controls the display footprint, never admission to a national contour layer.
  if (fraction >= .9) return {version: CARTOGRAPHIC_COVERAGE_VERSION, target: 'whole', fraction,
    value: input.value, label: `Couverture qualifiée ${(fraction * 100).toFixed(1)} % · valeur sur la zone couverte`, reason: 'display_threshold_reached'};
  if (input.geometrySupportId !== e.support_id) return missing('qualified_geometry_unavailable');
  return {version: CARTOGRAPHIC_COVERAGE_VERSION, target: 'covered', fraction, value: input.value,
    label: `Valeur sur la zone couverte uniquement (${(fraction * 100).toFixed(1)} %)`, reason: 'observed_area_only'};
}
