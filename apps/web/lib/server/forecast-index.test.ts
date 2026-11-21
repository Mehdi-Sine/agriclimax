import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {afterEach, expect, it, vi} from 'vitest';

vi.mock('server-only', () => ({}));
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
