import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { readAgriculture } from './agriculture';

it('serves the acquired official SAA series and preserves the Corsican code and real zero', async () => {
  const response = await readAgriculture(new Request('https://test/api/agriculture?action=dataset&indicator=saa-cop-03-surf-departement'));
  expect(response.status).toBe(200);
  const dataset = await response.json();
  expect(dataset.indicator.unit).toBe('ha');
  expect(dataset.rows.find((r: { code: string }) => r.code === '77').values.at(-1)).toBe(117468);
  expect(dataset.rows.find((r: { code: string }) => r.code === '2A').values.at(-1)).toBe(2);
  expect(dataset.rows.reduce((n: number, r: { values: (number | null)[] }) => n + (r.values.at(-1) ?? 0), 0)).toBe(4494355);
});
it('keeps agricultural coverage independent of climate activation and rejects unsafe selectors', async () => {
  vi.stubEnv('PRA_NATIONAL_ENABLED', '0');
  const catalog = await readAgriculture(new Request('https://test/api/agriculture?action=catalog'));
  expect(catalog.status).toBe(200);
  expect((await catalog.json()).indicators.length).toBeGreaterThan(490);
  for (const query of ['action=dataset&indicator=../../.env', 'action=catalog&action=dataset', 'action=dataset&indicator=invalid', 'action=wheat-context&pra=bad', 'action=catalog&year=2025']) {
    expect((await readAgriculture(new Request(`https://test/api/agriculture?${query}`))).status).toBe(400);
  }
  vi.unstubAllEnvs();
});
it('loads server artifacts independently of the runtime working directory', async () => {
  const cwd = vi.spyOn(process, 'cwd').mockReturnValue('/runtime-without-source-files');
  try {
    const response = await readAgriculture(new Request('https://test/api/agriculture?action=dataset&indicator=saa-cop-03-surf-departement'));
    expect(response.status).toBe(200);
  } finally { cwd.mockRestore(); }
});
