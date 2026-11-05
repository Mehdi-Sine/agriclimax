export interface NationalAvailability {
  source_id: 'era5-land';
  dataset_version: string;
  latest: string;
  days: string[];
  source_date: string;
  acquired_at: string | null;
  updated_at: string | null;
  freshness: 'recent_reanalysis' | 'stale';
  acquisition_time_status: 'known' | 'unknown';
}

export function isCalendarDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString().slice(0, 10) === value;
}

export function withinAvailable(date: string, days: string[]): boolean {
  return isCalendarDate(date) && days.length > 0 && date >= days[0] && date <= days.at(-1)!;
}

export function calendarDays(start: string, end: string): string[] {
  if (!isCalendarDate(start) || !isCalendarDate(end)) return [];
  const count = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  if (!Number.isInteger(count) || count < 1 || count > 400) return [];
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10));
}

export function trailingStart(end: string, days: number): string {
  return new Date(Date.parse(end) - (days - 1) * 86400000).toISOString().slice(0, 10);
}
