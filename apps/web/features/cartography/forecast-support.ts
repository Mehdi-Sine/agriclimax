/** COUV-05 binding only. COUV-04 remains the sole paint policy. */
import type { WeatherRow } from '../operational/model';
import { indicatorFamily, qualifyCoverage, type CoverageQuality } from '../climate-quality/policy';
import type { PraCollection } from '../national/map';

export const FORECAST_MASK_VERSION = 'couv05-native-cells-2';
export interface ForecastSupport {
  pra_id: string; model: string; run: string; period: string; variable: string;
  grid_version: string; weights_sha256: string; pra_weights_sha256: string; reference_sha256: string;
  source_sha256: string; support_id: string | null; fraction: number | null;
  status: 'unknown' | 'absent' | 'partial' | 'demonstrated'; geometry_verified: boolean; valid_native_cells?: number | null;
}
const models: Record<string, string> = { 'arome-0p025': 'arome', 'arpege-0p1': 'arpege', 'ifs-oper-0p25': 'ifs' };
const rules: Record<string,string> = {arome:'pra-national-weather-daily-1',arpege:'pra-national-weather-daily-1',ifs:'pra-weather-daily-2'};
const sources: Record<string, string> = { arome: 'meteofrance-arome', arpege: 'meteofrance-arpege', ifs: 'ecmwf-open-data' };
const digest = (value: string | null): value is string => !!value && /^[a-f0-9]{64}$/.test(value);
export function matchesForecastSupport(row: WeatherRow, proof: ForecastSupport, referenceSha: string): boolean {
  const model = models[row.model];
  return !!model && row.nature === 'forecast' && row.source_id === sources[model] &&
    row.rule_version === rules[model] && row.pra_id === proof.pra_id && model === proof.model && row.variable === proof.variable &&
    row.valid_date === proof.period && Number.isFinite(Date.parse(proof.run)) &&
    Date.parse(row.model_run_at ?? '') === Date.parse(proof.run) &&
    Date.parse(row.valid_from) === Date.parse(row.valid_date + 'T00:00:00Z') &&
    Date.parse(row.valid_to) - Date.parse(row.valid_from) === 86400000 &&
    row.provenance.reference_version === 'ofb-masa-pra-2017-snapshot-20261017' &&
    row.provenance.grid_version === proof.grid_version && row.provenance.checksum === proof.source_sha256 &&
    proof.grid_version === row.grid_version && proof.pra_weights_sha256 === row.weights_sha256 &&
    digest(referenceSha) && referenceSha === proof.reference_sha256 &&
    digest(proof.source_sha256) && proof.source_sha256 === row.provenance_sha256 &&
    digest(proof.support_id) &&
    ((proof.status === 'absent' && proof.fraction === 0 && proof.valid_native_cells === 0) ||
     (proof.geometry_verified && ['partial', 'demonstrated'].includes(proof.status) &&
      proof.fraction !== null && Number.isFinite(proof.fraction) && proof.fraction > 0 && proof.fraction <= 1)) &&
    proof.fraction !== null &&
    Math.abs(proof.fraction - row.spatial_coverage) <= 1e-5;
}
export function forecastSpatialQuality(row: WeatherRow, proof: ForecastSupport | undefined, referenceSha: string): CoverageQuality {
  const matched = !!proof && matchesForecastSupport(row, proof, referenceSha);
  return qualifyCoverage(row.status === 'unavailable' ? null : row.value,
    row.variable === 'humidity' ? 'specific' : indicatorFamily(row.variable), {
      fraction: matched ? proof.fraction : null, support_id: matched ? proof.support_id : null,
      mask: matched ? 'native_valid_cells' : 'unknown', represented_area_m2: null,
      expected_days: 1, available_days: row.temporal_coverage === 1 ? 1 : 0,
      continuous: row.temporal_coverage === 1, homogeneous: matched,
      method: matched ? FORECAST_MASK_VERSION : '', estimate_certificate: null, reference_compatible: false,
    });
}
export function boundForecastGeometries(rows: WeatherRow[], proofs: ForecastSupport[], collection: PraCollection, referenceSha: string): PraCollection {
  const supports = new Map<string, ForecastSupport>();
  for (const proof of proofs) {
    const key = `${proof.pra_id}/${proof.variable}/${proof.period}`;
    if (supports.has(key)) throw Error('FORECAST_SUPPORT_AMBIGUOUS');
    supports.set(key, proof);
  }
  const ids = new Set(rows.flatMap(row => {
    const proof = supports.get(`${row.pra_id}/${row.variable}/${row.valid_date}`);
    return proof && matchesForecastSupport(row, proof, referenceSha) ? [proof.support_id!] : [];
  }));
  return {type: 'FeatureCollection', features: collection.features.filter(f =>
    !!f.properties.support_id && ids.has(f.properties.support_id) &&
    proofs.some(p => p.pra_id === f.id && p.support_id === f.properties.support_id))};
}
