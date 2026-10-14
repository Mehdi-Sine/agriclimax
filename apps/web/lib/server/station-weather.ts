import 'server-only';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { ApiError } from './query';

// Local transport schema, not a change to the shared scientific contracts.
const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
const stamp = { type: 'string', format: 'date-time' };
const flags = { type: 'array', items: { type: 'string' }, maxItems: 30 };
const provenance = { type: 'object', additionalProperties: false,
  required: ['source_id', 'retrieved_at', 'published_at', 'checksum', 'demo', 'normalizer_version', 'publication_time_known'],
  properties: { source_id: { enum: ['meteofrance-climatology', 'meteofrance-observations'] },
    retrieved_at: stamp, published_at: { anyOf: [stamp, { type: 'null' }] }, checksum: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    demo: { const: false }, normalizer_version: { const: '1' }, publication_time_known: { const: false } } };
const nullableString = { type: ['string', 'null'] };
export interface StationObservation {
  cell_id: string; variable: string; observed_at: string; value: number | null; unit: string;
  source_timezone: string; source_unit: string; quality_flags: string[];
  source_field: string | null; source_checksum: string | null; temporal_resolution: string;
  provenance: { source_id: string; retrieved_at: string; published_at: string | null; checksum: string;
    demo: false; normalizer_version: string; publication_time_known: false };
}
export interface StationBatch {
  schema_version: string; source_id: string; valid_date: string; status: string; freshness: string;
  observations: StationObservation[]; issues: string[]; provenance: StationObservation['provenance'];
}
export interface WeatherStation {
  id: string; name: string; latitude: number; longitude: number; altitude_m: number;
  metadata: Record<string, unknown>; retrieved_at: string;
}
const stationValidator = ajv.compile<WeatherStation[]>({ type: 'array', maxItems: 100,
  items: { type: 'object', additionalProperties: false,
    required: ['id', 'name', 'latitude', 'longitude', 'altitude_m', 'metadata', 'retrieved_at'],
    properties: { id: { type: 'string', pattern: '^\\d{8}$' }, name: { type: 'string', minLength: 1 },
      latitude: { type: 'number', minimum: 41, maximum: 52 },
      longitude: { type: 'number', minimum: -6, maximum: 10 }, altitude_m: { type: 'number' },
      metadata: { type: 'object' }, retrieved_at: stamp } } });
const batchValidator = ajv.compile<StationBatch[]>({ type: 'array', maxItems: 366,
  items: { type: 'object', additionalProperties: false,
    required: ['schema_version', 'source_id', 'valid_date', 'status', 'freshness', 'observations', 'issues', 'provenance'],
    properties: { schema_version: { const: 'internal-1' }, source_id: provenance.properties.source_id,
      valid_date: { type: 'string', format: 'date' }, status: { enum: ['complete', 'partial', 'missing'] },
      freshness: { enum: ['fresh', 'stale'] }, provenance, issues: flags,
      observations: { type: 'array', maxItems: 6, items: { type: 'object', additionalProperties: false,
        required: ['cell_id', 'variable', 'observed_at', 'value', 'unit', 'source_timezone', 'source_unit',
          'quality_flags', 'provenance', 'source_field', 'source_checksum', 'temporal_resolution'],
        properties: { cell_id: { type: 'string', pattern: '^\\d{8}$' },
          variable: { enum: ['temperature', 'temperature_min', 'temperature_max', 'humidity', 'precipitation', 'etp_monteith'] },
          observed_at: stamp, value: { type: ['number', 'null'] }, unit: { enum: ['degC', '%', 'mm'] },
          source_timezone: { const: 'UTC' }, source_unit: { enum: ['degC', 'K', '%', 'mm'] },
          quality_flags: flags, provenance, source_field: nullableString,
          source_checksum: { type: ['string', 'null'], pattern: '^[a-f0-9]{64}$' },
          temporal_resolution: { enum: ['daily', 'hourly'] } } } } } } });

export class SupabaseStationWeatherRepository {
  constructor(private readonly transport: typeof fetch = fetch) {}
  private async rpc(name: string, body: Record<string, string>): Promise<unknown> {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!base || !key) throw new ApiError('NOT_CONFIGURED', 503);
    let url: URL;
    try {
      url = new URL(base);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
      url.pathname = `/rest/v1/rpc/${name}`;
    } catch { throw new ApiError('NOT_CONFIGURED', 503); }
    try {
      const response = await this.transport(url, { method: 'POST', cache: 'no-store', redirect: 'error',
        signal: AbortSignal.timeout(8000), headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body) });
      if (!response.ok) throw new ApiError('UPSTREAM_UNAVAILABLE', 502);
      const text = await response.text();
      if (text.length > 4_000_000) throw new ApiError('INVALID_RESPONSE', 502);
      return JSON.parse(text) as unknown;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('UPSTREAM_UNAVAILABLE', 502);
    }
  }
  async stations() {
    const value = await this.rpc('agriclimax_weather_stations', {});
    if (!stationValidator(value)) throw new ApiError('INVALID_RESPONSE', 502);
    return value;
  }
  async series(query: Record<string, string>) {
    const value = await this.rpc('agriclimax_station_weather', query);
    if (!batchValidator(value)) throw new ApiError('INVALID_RESPONSE', 502);
    const dates = new Set<string>();
    for (const batch of value) {
      if (batch.source_id !== query.p_source || batch.provenance.source_id !== query.p_source
        || batch.valid_date < query.p_start || batch.valid_date > query.p_end || dates.has(batch.valid_date)) throw new ApiError('INVALID_RESPONSE', 502);
      dates.add(batch.valid_date);
      const rows = new Set<string>();
      for (const row of batch.observations) {
        const rowKey = `${row.variable}:${row.observed_at}`;
        if (row.cell_id !== query.p_station || row.provenance.source_id !== query.p_source
          || new Date(row.observed_at).toISOString().slice(0, 10) !== batch.valid_date
          || rows.has(rowKey) || Date.parse(row.observed_at) > Date.now()
          || row.unit !== (row.variable.startsWith('temperature') ? 'degC' : row.variable === 'humidity' ? '%' : 'mm')
          || (row.value !== null && ((row.variable === 'humidity' && (row.value < 0 || row.value > 100))
            || (['precipitation', 'etp_monteith'].includes(row.variable) && row.value < 0)))) throw new ApiError('INVALID_RESPONSE', 502);
        rows.add(rowKey);
      }
    }
    return value.map(batch => ({ ...batch,
      freshness: Date.now() - Math.max(Date.parse(`${batch.valid_date}T00:00:00Z`),
        ...batch.observations.map(row => Date.parse(row.observed_at))) > 48 * 3600000 ? 'stale' : 'fresh',
      retrieval_freshness: Date.now() - Date.parse(batch.provenance.retrieved_at) > 48 * 3600000 ? 'stale' : 'fresh',
      publication_freshness: 'unknown' as const }));
  }
}

function invalid(): never { throw new ApiError('INVALID_QUERY', 400); }
function calendar(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return invalid();
  const stamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value ? value : invalid();
}
export async function readStationWeather(request: Request, kind: 'stations' | 'series',
  repository = new SupabaseStationWeatherRepository()): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  try {
    const p = new URL(request.url).searchParams;
    const allowed = kind === 'stations' ? ['mode'] : ['mode', 'station', 'start', 'end', 'product'];
    for (const key of p.keys()) if (!allowed.includes(key) || p.getAll(key).length !== 1) invalid();
    if (p.get('mode') !== 'live_meteofrance') invalid();
    let data: unknown;
    if (kind === 'stations') data = await repository.stations();
    else {
      const station = p.get('station');
      if (!station || !/^\d{8}$/.test(station)) invalid();
      const start = calendar(p.get('start')), end = calendar(p.get('end'));
      const days = (Date.parse(end) - Date.parse(start)) / 86400000;
      if (days < 0 || days > 365) invalid();
      const product = p.get('product');
      if (!product || !['climatology', 'observations'].includes(product)) invalid();
      data = await repository.series({ p_station: station, p_start: start, p_end: end,
        p_source: `meteofrance-${product}` });
    }
    return Response.json({ mode: 'live_meteofrance', spatial_support: 'station_points',
      interpolation: 'none', risk_computed: false, et0_status: 'not_asserted_use_source_etp_monteith',
      source_attribution: 'Source : Météo-France', data }, { headers });
  } catch (error) {
    const safe = error instanceof ApiError ? error : new ApiError('UPSTREAM_UNAVAILABLE', 502);
    return Response.json({ error: { code: safe.code, message: 'Données station indisponibles ou requête invalide.' } },
      { status: safe.status, headers });
  }
}
