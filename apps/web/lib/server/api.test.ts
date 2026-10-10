import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import fixture from '../../../../fixtures/contracts/risk-result.json';
import { ApiError, parseMap, parseSeries, parseTerritory } from './query';
import { SupabaseRiskRepository } from './supabase-risk-repository';
import { readRisks } from './api-handler';
import { validateMap, validateSeries, validateTerritory } from './response-validation';

const base = 'production=wheat_soft&indicator=tmax_days_above&rule=demo-rule&version=1.0';
const mapParameters = `${base}&date=2026-07-01&bbox=-5,43,1,49`;
const params = (s: string) => new URLSearchParams(s);
afterEach(() => vi.unstubAllEnvs());

describe('bounded transport queries', () => {
  it('requires scientific version and parses explicit defaults', () => {
    expect(parseMap(params(mapParameters))).toMatchObject({ p_bbox: [-5,43,1,49], p_zoom: 6, p_limit: 1000 });
    expect(() => parseMap(params('production=wheat_soft&indicator=tmax_days_above&date=2026-07-01&bbox=-5,43,1,49'))).toThrow(ApiError);
  });
  it.each(['date=2026-02-30', 'bbox=180,0,-180,1', 'bbox=NaN,0,1,1', 'bbox=,0,1,1',
    'bbox=-181,0,1,1', 'zoom=23', 'limit=2001', 'limit=0', 'limit=1.1', 'limit=0x10'])('rejects %s', replacement => {
    const p = params(mapParameters), [key,value] = replacement.split('=');
    p.set(key,value);
    expect(() => parseMap(p)).toThrow(ApiError);
  });
  it('rejects duplicates, unknown fields and attempts at SQL injection', () => {
    expect(() => parseMap(params(`${mapParameters}&rule=another`))).toThrow(ApiError);
    expect(() => parseMap(params(`${mapParameters}&secret=oops`))).toThrow(ApiError);
    const p = params(mapParameters); p.set('rule', "x'; drop table risk_results; --");
    expect(() => parseMap(p)).toThrow(ApiError);
  });
  it('bounds series and territory ranges to 366 calendar dates', () => {
    expect(parseSeries(params(`${base}&cell=cell-1&start=2026-01-01&end=2027-01-01`)).p_cell).toBe('cell-1');
    expect(() => parseSeries(params(`${base}&cell=cell-1&start=2026-01-01&end=2027-01-02`))).toThrow(ApiError);
    expect(() => parseTerritory(params(`${base}&start=2026-07-02&end=2026-07-01&bbox=-5,43,1,49`))).toThrow(ApiError);
  });
});

describe('server repository and stable errors', () => {
  it('does not call Supabase when credentials are absent', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL',''); vi.stubEnv('SUPABASE_SECRET_KEY','');
    const transport = vi.fn<typeof fetch>();
    const response = await readRisks(new Request(`https://app.test/api/risks/map?${mapParameters}`), 'map', new SupabaseRiskRepository(transport));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: 'NOT_CONFIGURED', message: 'Service de données non configuré.' } });
    expect(transport).not.toHaveBeenCalled();
  });
  it('returns 400 before reading credentials or accessing the network', async () => {
    const transport = vi.fn<typeof fetch>();
    const response = await readRisks(new Request('https://app.test/api/risks/map?bbox=oops'), 'map', new SupabaseRiskRepository(transport));
    expect(response.status).toBe(400); expect(transport).not.toHaveBeenCalled();
  });
  it('sends a secret only as an upstream apikey and disables caching/redirects', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://project.supabase.co');
    vi.stubEnv('SUPABASE_SECRET_KEY','test-secret-sentinel');
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ type: 'FeatureCollection', features: [], truncated: false, limit: 1000 }));
    const response = await readRisks(new Request(`https://app.test/api/risks/map?${mapParameters}`), 'map', new SupabaseRiskRepository(transport));
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('no-store');
    const [url,init] = transport.mock.calls[0];
    expect(String(url)).toBe('https://project.supabase.co/rest/v1/rpc/agriclimax_map_risks');
    expect(init).toMatchObject({ method: 'POST', cache: 'no-store', redirect: 'error', headers: { apikey: 'test-secret-sentinel' } });
    expect(JSON.stringify(await response.json())).not.toContain('test-secret-sentinel');
  });
  it.each([new Response('test-secret-sentinel SQL detail', { status: 500 }), Response.json({ unexpected: true })])('does not reflect upstream content', async upstream => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://project.supabase.co'); vi.stubEnv('SUPABASE_SECRET_KEY','test-secret-sentinel');
    const response = await readRisks(new Request(`https://app.test/api/risks/map?${mapParameters}`), 'map',
      new SupabaseRiskRepository(vi.fn<typeof fetch>().mockResolvedValue(upstream)));
    expect(response.status).toBe(502); expect(await response.text()).not.toContain('test-secret-sentinel');
  });
  it('sanitizes network exceptions', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://project.supabase.co'); vi.stubEnv('SUPABASE_SECRET_KEY','test-secret-sentinel');
    const response = await readRisks(new Request(`https://app.test/api/risks/map?${mapParameters}`), 'map',
      new SupabaseRiskRepository(vi.fn<typeof fetch>().mockRejectedValue(new Error('test-secret-sentinel'))));
    expect(response.status).toBe(502); expect(await response.text()).not.toContain('test-secret-sentinel');
  });
});

describe('frozen JSON contracts', () => {
  it('accepts the V1 fixture and rejects incomplete provenance', () => {
    expect(validateSeries([fixture])).toEqual([fixture]);
    expect(() => validateSeries([{ ...fixture, provenance: [] }])).toThrow(ApiError);
    expect(() => validateSeries([{ ...fixture, risk: { level: 'confidence' } }])).toThrow(ApiError);
  });
  it('requires a full risk payload on every map feature', () => {
    const feature = { type: 'Feature', id: '123e4567-e89b-42d3-a456-426614174000',
      geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] },
      properties: { cell_id: fixture.cell_id, valid_date: fixture.valid_date,
        production_id: fixture.production_id, indicator_id: fixture.indicator_id,
        risk_level: fixture.risk.level, confidence_level: fixture.confidence.level,
        freshness: fixture.quality.freshness, result: fixture } };
    expect(validateMap({ type: 'FeatureCollection', features: [feature], truncated: false, limit: 1 }).features).toHaveLength(1);
    expect(() => validateMap({ type: 'FeatureCollection', features: [feature,feature], truncated: true, limit: 1 })).toThrow(ApiError);
  });
  it('rejects fabricated aggregate classifications', () => {
    expect(() => validateTerritory({ production_id: 'x', indicator_id: 'x', rule: { rule_id: 'x', version: '1' },
      bbox: [0,0,1,1], aggregation: 'intersecting_cell_counts', groups: [{ valid_date: '2026-07-01',
        risk_level: 'validated', confidence_level: 'high', freshness: 'fresh', cell_count: 1,
        latest_computed_at: '2026-07-01T00:00:00Z' }] })).toThrow(ApiError);
  });
});
