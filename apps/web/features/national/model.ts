export const NATIONAL = {
  reference: 'ofb-masa-pra-2017-snapshot-20261017',
  dataset: 'era5land-national-20260919-20261018-v1',
  climatology: 'era5land-pra1991-2020-annual-compact-v1-9babc3b9b96830d2',
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

export type ClimateVariable = (typeof VARIABLES)[number]['key'];

export type ClimateContextRow = {
  pra_id?: string;
  date?: string;
  variable?: ClimateVariable;
  current_status?: string | null;
  current_value: number | null;
  normal_1991_2020: number | null;
  anomaly: number | null;
  sample_years: number | null;
  expected_years: number;
  reference_coverage: number | null;
  current_coverage: number | null;
  status: 'available' | 'missing_current' | 'missing_reference';
  normal_status: string;
};

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

export function anomalyLabel(
  value: number | null | undefined,
  unit: string,
): string {
  if (value == null) return 'NULL · non calculable';
  const signed = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 2,
    signDisplay: 'always',
  }).format(value);
  return `${signed} ${unit}`;
}

export function anomalyBand(
  value: number | null | undefined,
): 'above' | 'near' | 'below' | 'missing' {
  if (value == null) return 'missing';
  if (value > 1) return 'above';
  if (value < -1) return 'below';
  return 'near';
}
