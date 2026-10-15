import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { readFranceClimate } from './france-climate';
const row = { cell_id: 'era5land.48.9.2.3', valid_date: '2026-10-01', latitude: 48.9, longitude: 2.3,
  temperature: 10, temperature_min: 5, temperature_max: 15, precipitation: null,
  quality_flags: ['missing'], acquisition_key: 'a'.repeat(64) };
const page = { support: 'era5_land_grid', interpolation: 'none', data: [row], next_cursor: row.cell_id };
const url = 'https://app.test/api/climate/france?version=test&date=2026-10-01';
function configured() { vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('SUPABASE_SECRET_KEY', 'synthetic-test-key'); }
afterEach(() => vi.unstubAllEnvs());
it('serves grid support, explicit missing values and a bounded continuation cursor', async () => {
  configured(); const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(page));
  const response = await readFranceClimate(new Request(url), transport);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ support: 'era5_land_grid', interpolation: 'none',
    risk_computed: false, data: [{ precipitation: null }], next_cursor: row.cell_id });
  expect(transport.mock.calls[0][1]).toMatchObject({ redirect: 'error', cache: 'no-store',
    body: JSON.stringify({ p_version: 'test', p_date: '2026-10-01', p_after: '', p_limit: 1000 }) });
});
it.each(['&limit=1001', '&limit=0', '&date=2026-10-01', '&unknown=yes', '&after=station123',
  '&limit=NaN'])('rejects invalid query before network %s', async suffix => {
  const transport = vi.fn<typeof fetch>();
  expect((await readFranceClimate(new Request(url + suffix), transport)).status).toBe(400);
  expect(transport).not.toHaveBeenCalled();
});
it('rejects invalid calendar dates', async () => {
  expect((await readFranceClimate(new Request(url.replace('2026-10-01', '2026-02-30')))).status).toBe(400);
});
it('returns absent for a valid empty result, without inventing a safe risk', async () => {
  configured(); const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ...page, data: [], next_cursor: null }));
  const result = await readFranceClimate(new Request(url), transport);
  expect(await result.json()).toMatchObject({ state: 'absent', risk_computed: false });
});
it.each([{ ...page, data: [row, row] }, { ...page, support: 'station_points' },
  { ...page, data: [{ ...row, valid_date: '2026-10-02' }] },
  { ...page, next_cursor: 'unrelated' }, { ...page, data: [{ ...row, temperature: 150 }] }])(
  'rejects incompatible upstream grid responses', async value => {
    configured(); const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(value));
    expect((await readFranceClimate(new Request(url), transport)).status).toBe(502);
  });
it('sanitizes upstream errors', async () => {
  configured(); const transport = vi.fn<typeof fetch>().mockRejectedValue(new Error('synthetic-test-key'));
  const response = await readFranceClimate(new Request(url), transport);
  expect(await response.text()).not.toContain('synthetic-test-key');
});
