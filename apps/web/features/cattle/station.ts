import type { StationBatch } from '../../lib/server/station-weather';
import { evaluateThi, type Sample } from './thi';
export function stationExposure(batches: StationBatch[], station: string, start: string, end: string, resolution: 'daily' | 'hourly' = 'daily') {
  const pairs = new Map<string, Partial<Sample>>();
  const source = resolution === 'daily' ? 'meteofrance-climatology' : 'meteofrance-observations';
  for (const batch of batches) {
    if (batch.source_id !== source || batch.provenance.demo || batch.status === 'invalid') throw new Error('Real Task11 source required');
    for (const row of batch.observations) {
      if (row.cell_id !== station || !['temperature', 'humidity'].includes(row.variable)) continue;
      if (row.temporal_resolution !== resolution || row.provenance.source_id !== source
        || row.unit !== (row.variable === 'temperature' ? 'degC' : '%')) throw new Error('Incompatible pair');
      const at = new Date(row.observed_at).toISOString();
      const pair = pairs.get(at) ?? {at};
      const field = row.variable === 'temperature' ? 'temperature_c' : 'humidity_pct';
      if (field in pair) throw new Error('Duplicate variable');
      pair[field] = row.value;
      pairs.set(at, pair);
    }
  }
  const samples = [...pairs.values()].map(row => ({at: row.at!, temperature_c: row.temperature_c ?? null, humidity_pct: row.humidity_pct ?? null}));
  const result = evaluateThi(samples, {start: `${start}T00:00:00Z`, end: new Date(Date.parse(end)+86400000).toISOString(),
    resolution, freshness: batches.length ? batches.some(b => b.freshness === 'stale') ? 'stale' : 'fresh' : 'unknown',
    provenance: batches.map(b => b.provenance)});
  return {...result, station_id: station, spatial_support: 'station_points_no_interpolation',
    source_quality_flags: [...new Set(batches.flatMap(b => b.observations.flatMap(r => r.quality_flags)))]};
}
