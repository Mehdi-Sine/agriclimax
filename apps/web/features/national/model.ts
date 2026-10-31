export const NATIONAL = {
  reference: 'ofb-masa-pra-2017-snapshot-20261017',
  dataset: 'era5land-national-20260919-20261018-v1',
  start: '2026-09-19',
  end: '2026-10-18',
  count: 713,
} as const;
export const VARIABLES = [
  { key: 'temperature', label: 'Tmean · moyenne spatiale', unit: '°C' },
  { key: 'temperature_min', label: 'Tmin · minimum des cellules', unit: '°C' },
  { key: 'temperature_max', label: 'Tmax · maximum des cellules', unit: '°C' },
  {
    key: 'precipitation',
    label: 'Précipitation · moyenne spatiale',
    unit: 'mm',
  },
] as const;
export const DAYS = Array.from({ length: 30 }, (_, i) =>
  new Date(Date.parse(NATIONAL.start) + i * 86400000)
    .toISOString()
    .slice(0, 10),
);
export function availability(
  row: { status?: string } | undefined,
): 'complete' | 'partial' | 'unavailable' | 'absent' {
  return row?.status === 'available'
    ? 'complete'
    : row?.status === 'partial'
      ? 'partial'
      : row?.status === 'unavailable'
        ? 'unavailable'
        : 'absent';
}
export function valueLabel(value: number | null | undefined): string {
  return value == null
    ? 'NULL · indisponible'
    : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(
        value,
      );
}
