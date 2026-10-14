import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { readStationWeather, SupabaseStationWeatherRepository } from './station-weather';

const query = 'mode=live_meteofrance&station=29075001&start=2026-09-01&end=2026-09-30&product=climatology';
const provenance = { source_id: 'meteofrance-climatology', retrieved_at: '2026-10-14T12:00:00Z',
  published_at: null, checksum: 'a'.repeat(64), demo: false,
  normalizer_version: '1', publication_time_known: false };
const batch = { schema_version: 'internal-1', source_id: 'meteofrance-climatology', valid_date: '2026-09-01',
  status: 'partial', freshness: 'fresh', observations: [{ cell_id: '29075001', variable: 'temperature_min',
    observed_at: '2026-09-01T00:00:00Z', value: 10.2, unit: 'degC', source_timezone: 'UTC', source_unit: 'degC',
    quality_flags: ['daily_source_date_label', 'publication_time_unknown'], provenance,
    source_field: 'TN', source_checksum: 'b'.repeat(64), temporal_resolution: 'daily' }], issues: [], provenance };
function credentials() {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('SUPABASE_SECRET_KEY', 'synthetic-station-secret');
}
function call(params = query, response: unknown = [batch]) {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(response));
  return { transport, result: readStationWeather(new Request(`https://app.test/api/weather/series?${params}`),
    'series', new SupabaseStationWeatherRepository(transport)) };
}
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('live station API isolated from demo and risk classification', () => {
  it('serves real-shaped station observations, provenance, missing data and current freshness', async () => {
    credentials(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-14T13:00:00Z'));
    const { result, transport } = call();
    const response = await result;
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ mode: 'live_meteofrance', spatial_support: 'station_points',
      interpolation: 'none', risk_computed: false, data: [{ status: 'partial', freshness: 'stale',
        retrieval_freshness: 'fresh', publication_freshness: 'unknown',
        observations: [{ value: 10.2, source_field: 'TN', provenance: { demo: false } }] }] });
    expect(transport.mock.calls[0][1]).toMatchObject({ cache: 'no-store', redirect: 'error',
      headers: { apikey: 'synthetic-station-secret' } });
  });
  it.each(['', query.replace('live_meteofrance', 'demo'), query + '&station=another',
    query + '&unknown=1', query.replace('2026-09-01', '2026-02-30'),
    query.replace('2026-09-30', '2028-01-01'), query.replace('29075001', 'bad'),
    query.replace('climatology', 'era5')])('rejects invalid query before network: %s', async params => {
    const { result, transport } = call(params);
    expect((await result).status).toBe(400);
    expect(transport).not.toHaveBeenCalled();
  });
  it('requires server configuration and never falls back to fixtures', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', ''); vi.stubEnv('SUPABASE_SECRET_KEY', '');
    const { result, transport } = call();
    expect((await result).status).toBe(503); expect(transport).not.toHaveBeenCalled();
  });
  it.each([[{ ...batch, source_id: 'demo-weather' }], [{ ...batch, provenance: { ...provenance, demo: true } }],
    [batch, batch], [{ ...batch, observations: [{ ...batch.observations[0], cell_id: '13054001' }] }],
    [{ ...batch, observations: [{ ...batch.observations[0], unit: 'K' }] }], [{ secret: 'synthetic-station-secret' }]]
    .map(response => ({ response })))(
    'rejects incompatible data without reflecting upstream content', async ({ response }) => {
      credentials(); const r = await call(query, response).result;
      expect(r.status).toBe(502); expect(await r.text()).not.toContain('synthetic-station-secret');
    });
  it('keeps empty data distinct from no-risk', async () => {
    credentials(); const r = await call(query, []).result;
    expect(r.status).toBe(200); expect(await r.json()).toMatchObject({ data: [], risk_computed: false });
  });
  it('sanitizes transport errors and serves station points', async () => {
    credentials();
    const transport = vi.fn<typeof fetch>().mockRejectedValue(new Error('synthetic-station-secret'));
    const request = new Request('https://app.test/api/weather/stations?mode=live_meteofrance');
    const r = await readStationWeather(request, 'stations', new SupabaseStationWeatherRepository(transport));
    expect(r.status).toBe(502); expect(await r.text()).not.toContain('synthetic-station-secret');
    const stations = [{ id: '29075001', name: 'SYNTHETIC', latitude: 48.45, longitude: -4.39,
      altitude_m: 92, metadata: { api_version: 'DPClim/v1' }, retrieved_at: provenance.retrieved_at }];
    transport.mockResolvedValue(Response.json(stations));
    const ok = await readStationWeather(request, 'stations', new SupabaseStationWeatherRepository(transport));
    expect(ok.status).toBe(200); expect(await ok.json()).toMatchObject({ data: stations });
  });
});
