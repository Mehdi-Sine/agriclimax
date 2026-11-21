import {afterEach, expect, it, vi} from 'vitest';
afterEach(() => {vi.unstubAllEnvs(); vi.resetModules();});
it('activates history alone while forecast rendering remains disabled', async () => {
  vi.stubEnv('NEXT_PUBLIC_COUV04_RENDER_ENABLED','false');
  vi.stubEnv('NEXT_PUBLIC_COUV06_HISTORICAL_RENDER_ENABLED','true');
  vi.resetModules();
  const {coverageEnabledFor} = await import('./coverage');
  expect(coverageEnabledFor('reanalysis')).toBe(true);
  expect(coverageEnabledFor('forecast')).toBe(false);
});
it('rolls back history independently when forecast rendering is enabled', async () => {
  vi.stubEnv('NEXT_PUBLIC_COUV04_RENDER_ENABLED','false');
  vi.stubEnv('NEXT_PUBLIC_COUV06_HISTORICAL_RENDER_ENABLED','false');
  vi.resetModules();
  expect((await import('./coverage')).coverageEnabledFor('reanalysis')).toBe(false);
  vi.stubEnv('NEXT_PUBLIC_COUV04_RENDER_ENABLED','true');
  vi.resetModules();
  const {coverageEnabledFor} = await import('./coverage');
  expect(coverageEnabledFor('reanalysis')).toBe(false);
  expect(coverageEnabledFor('forecast')).toBe(true);
});

it('shows historical coverage without configuring a build flag', async () => {
  vi.stubEnv('NEXT_PUBLIC_COUV04_RENDER_ENABLED','false');
  vi.stubEnv('NEXT_PUBLIC_COUV06_HISTORICAL_RENDER_ENABLED',undefined);
  vi.resetModules();
  const {coverageEnabledFor} = await import('./coverage');
  expect(coverageEnabledFor('reanalysis')).toBe(true);
  expect(coverageEnabledFor('forecast')).toBe(false);
});
