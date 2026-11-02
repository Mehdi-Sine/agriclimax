import { expect, it } from 'vitest';
import {
  anomalyBand,
  anomalyLabel,
  availability,
  valueLabel,
  DAYS,
  NATIONAL,
} from './model';

it('keeps complete, partial, unavailable and unrequested separate', () => {
  expect(
    ['available', 'partial', 'unavailable'].map((status) =>
      availability({ status }),
    ),
  ).toEqual(['complete', 'partial', 'unavailable']);
  expect(availability(undefined)).toBe('absent');
});

it('never formats NULL as zero and preserves the exact 30-day UTC window', () => {
  expect(valueLabel(null)).toContain('NULL');
  expect(valueLabel(0)).toBe('0');
  expect(DAYS).toHaveLength(30);
  expect(DAYS[0]).toBe('2026-09-19');
  expect(DAYS.at(-1)).toBe('2026-10-18');
});

it('keeps climate anomalies explicit and bounded to the active climatology', () => {
  expect(NATIONAL.climatology).toContain('annual-compact');
  expect(anomalyLabel(null, '°C')).toContain('NULL');
  expect(anomalyLabel(1.25, '°C')).toContain('+1,25');
  expect(anomalyBand(null)).toBe('missing');
  expect(anomalyBand(-1.01)).toBe('below');
  expect(anomalyBand(0.5)).toBe('near');
  expect(anomalyBand(1.01)).toBe('above');
});
