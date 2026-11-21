import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {afterEach, expect, it, vi} from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./weather-archives', () => ({forecastBindingObject: vi.fn()}));
import {FORECAST_REFERENCE_SHA256, forecastIndexPin} from './forecast-index';

const first = 'a'.repeat(64);
const second = 'b'.repeat(64);
const firstPin = 'c'.repeat(64);
const secondPin = 'd'.repeat(64);

afterEach(() => vi.unstubAllEnvs());

it('resolves two exact archive bindings independently and never uses the legacy pin on a miss', () => {
  vi.stubEnv('COUV05_RENDER_ENABLED', 'true');
  vi.stubEnv('COUV05_ARCHIVE_INDEX_PINS', `${first}=${firstPin},${second}=${secondPin}`);
  vi.stubEnv('COUV05_INDEX_SHA256', 'e'.repeat(64));
  expect(forecastIndexPin(first)).toBe(firstPin);
  expect(forecastIndexPin(second)).toBe(secondPin);
  expect(forecastIndexPin('f'.repeat(64))).toBeUndefined();
  vi.stubEnv('COUV05_ARCHIVE_INDEX_PINS', `${first}=${secondPin}`);
  expect(forecastIndexPin(first)).toBe(secondPin);
  vi.stubEnv('COUV05_RENDER_ENABLED', 'false');
  expect(forecastIndexPin(first)).toBeUndefined();
});

it('rejects a malformed or ambiguous binding table', () => {
  vi.stubEnv('COUV05_RENDER_ENABLED', 'true');
  vi.stubEnv('COUV05_ARCHIVE_INDEX_PINS', `${first}=${firstPin},${first}=${secondPin}`);
  expect(forecastIndexPin(first)).toBeUndefined();
  vi.stubEnv('COUV05_ARCHIVE_INDEX_PINS', `${first}=${firstPin},invalid`);
  expect(forecastIndexPin(first)).toBeUndefined();
});

it('binds to the exact official PRA snapshot bytes', () => {
  const bytes = readFileSync('../../config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json');
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(FORECAST_REFERENCE_SHA256);
});

it('discovers a committed binding only for its exact archive and rolls back with the render flag', async () => {
  const {forecastIndexLocation} = await import('./forecast-index');
  const {forecastBindingObject} = await import('./weather-archives');
  const storage = vi.mocked(forecastBindingObject);
  const archive = '1'.repeat(64);
  const unrelated = '2'.repeat(64);
  vi.stubEnv('COUV05_RENDER_ENABLED', 'true');
  vi.stubEnv('COUV05_DAILY_INDEX_ENABLED', 'true');
  vi.stubEnv('COUV05_ARCHIVE_INDEX_PINS', undefined);
  storage.mockResolvedValue(Buffer.from(JSON.stringify({
    version: 'forecast-native-binding-1',
    archive_sha256: archive,
    index_sha256: firstPin,
    layout: 'cycle',
  })));
  expect(await forecastIndexLocation(archive)).toEqual({pin: firstPin, prefix: `forecast-native/v1/${archive}/`});
  await expect(forecastIndexLocation(unrelated)).rejects.toThrow('FORECAST_MASK_ARCHIVE_BINDING');
  vi.stubEnv('COUV05_RENDER_ENABLED', 'false');
  expect(await forecastIndexLocation(archive)).toBeUndefined();
});
