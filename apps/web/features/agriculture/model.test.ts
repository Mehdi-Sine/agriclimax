import { describe, expect, it } from 'vitest';
import { agriculturalValue, type AgriculturalSeries } from './model';

describe('native agricultural values', () => {
  const row: AgriculturalSeries = { code: '2A', name: 'Corse-du-Sud', values: [0, null, 42], statuses: ['available', 'suppressed', 'available'], quality_code: '2', source_anomalies: {} };
  it('distinguishes real zero, confidentiality and years outside the source', () => {
    expect(agriculturalValue(row, [2023, 2024, 2025], 2023)).toEqual({ value: 0, status: 'available' });
    expect(agriculturalValue(row, [2023, 2024, 2025], 2024)).toEqual({ value: null, status: 'suppressed' });
    expect(agriculturalValue(row, [2023, 2024, 2025], 2026)).toEqual({ value: null, status: 'unavailable' });
  });
});
