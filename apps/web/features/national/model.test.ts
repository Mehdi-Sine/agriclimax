import { expect, it } from 'vitest';
import { availability, valueLabel, DAYS } from './model';
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
