import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { readNational } from './national';
import { DAYS } from '../../features/national/model';
function configure() {
  vi.stubEnv('PRA_NATIONAL_ENABLED', '1');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('SUPABASE_SECRET_KEY', 'synthetic-private-key');
}
afterEach(() => vi.unstubAllEnvs());
it('gates the public activation until the operator enables the secured environment', async () => {
  vi.stubEnv('PRA_NATIONAL_ENABLED', '');
  const f = vi.fn<typeof fetch>();
  expect(
    (
      await readNational(
        new Request('https://test/api/national?action=day&date=2026-10-18'),
        f,
      )
    ).status,
  ).toBe(503);
  expect(f).not.toHaveBeenCalled();
});
it.each([
  '',
  '?action=day',
  '?action=day&date=2026-10-19',
  '?action=history&pra=station:1',
  '?action=day&date=2026-10-18&dataset=demo',
  '?action=day&date=2026-10-18&date=2026-10-18',
])('rejects absent, out-of-window and unexpected selectors: %s', async (q) => {
  configure();
  const f = vi.fn<typeof fetch>();
  expect(
    (await readNational(new Request(`https://test/api/national${q}`), f))
      .status,
  ).toBe(400);
  expect(f).not.toHaveBeenCalled();
});
it('cannot pass partial national pagination off as all 713', async () => {
  configure();
  const f = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json({
        source_id: 'era5-land',
        source_kind: 'reanalysis',
        method_version: 'pra-native-1',
        data: [],
        next_cursor: null,
      }),
    );
  expect(
    (
      await readNational(
        new Request('https://test/api/national?action=day&date=2026-10-18'),
        f,
      )
    ).status,
  ).toBe(502);
});
it('reads precisely one PRA across both months and preserves unavailable NULLs', async () => {
  configure();
  const f = vi.fn<typeof fetch>().mockImplementation(async (_url, options) => {
    const q = JSON.parse(String(options?.body));
    return Response.json({
      source_id: 'era5-land',
      source_kind: 'reanalysis',
      method_version: 'pra-native-1',
      data: [
        {
          id: 'pra:29102',
          name: 'Synthetic unavailable',
          area_km2: 10,
          department_code: '29',
          region_code: '53',
          valid_date: q.p_date,
          temperature: null,
          temperature_min: null,
          temperature_max: null,
          precipitation: null,
          coverage: [0, 0, 0, 0],
          valid_counts: [0, 0, 0, 0],
          expected_cells: 6,
          status: 'partial',
          freshness: 'stale',
          computed_at: '2026-10-30T00:00:00Z',
          batch_key: 'a'.repeat(64),
          quality_flags: ['missing_cells'],
        },
      ],
      next_cursor: null,
    });
  });
  const response = await readNational(
    new Request('https://test/api/national?action=history&pra=pra:29102'),
    f,
  );
  expect(response.status).toBe(200);
  const raw = await response.json();
  expect(raw.data.map((r: { valid_date: string }) => r.valid_date)).toEqual(
    DAYS,
  );
  expect(
    raw.data.every(
      (r: { status: string; temperature: null }) =>
        r.status === 'unavailable' && r.temperature === null,
    ),
  ).toBe(true);
  expect(f).toHaveBeenCalledTimes(30);
  expect(JSON.stringify(raw)).not.toContain('synthetic-private-key');
});
it('network failures never expose credentials or a fallback dataset', async () => {
  configure();
  const f = vi
    .fn<typeof fetch>()
    .mockRejectedValue(new Error('synthetic-private-key'));
  const r = await readNational(
    new Request('https://test/api/national?action=day&date=2026-10-18'),
    f,
  );
  expect(r.status).toBe(502);
  expect(await r.json()).toEqual({ error: 'UPSTREAM_UNAVAILABLE' });
});
