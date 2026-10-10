export class ApiError extends Error {
  constructor(readonly code: 'INVALID_QUERY' | 'NOT_CONFIGURED' | 'UPSTREAM_UNAVAILABLE' | 'INVALID_RESPONSE', readonly status: number) {
    super(code);
  }
}

export interface Filters {
  p_production: string;
  p_indicator: string;
  p_rule: string;
  p_version: string;
}
export interface MapQuery extends Filters {
  p_date: string;
  p_bbox: [number, number, number, number];
  p_zoom: number;
  p_limit: number;
}
export interface SeriesQuery extends Filters { p_cell: string; p_start: string; p_end: string }
export interface TerritoryQuery extends Filters { p_start: string; p_end: string; p_bbox: [number, number, number, number] }
export type QueryKind = 'map' | 'series' | 'territory';

function invalid(): never { throw new ApiError('INVALID_QUERY', 400); }
function identifier(p: URLSearchParams, key: string): string {
  const v = p.get(key);
  return v && /^[A-Za-z0-9_.-]{1,100}$/.test(v) ? v : invalid();
}
function date(p: URLSearchParams, key: string): string {
  const v = p.get(key);
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v) || v.startsWith('0000')) return invalid();
  const timestamp = Date.parse(`${v}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === v ? v : invalid();
}
function bbox(p: URLSearchParams): [number, number, number, number] {
  const parts = p.get('bbox')?.split(',');
  if (!parts || parts.length !== 4 || parts.some(v => !/^-?\d+(\.\d+)?$/.test(v))) return invalid();
  const [west, south, east, north] = parts.map(Number);
  if (![west, south, east, north].every(Number.isFinite)
    || west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) return invalid();
  return [west, south, east, north];
}
function integer(p: URLSearchParams, key: string, fallback: number, min: number, max: number): number {
  if (!p.has(key)) return fallback;
  const v = p.get(key)!;
  if (!/^\d+$/.test(v) || Number(v) < min || Number(v) > max) return invalid();
  return Number(v);
}
function filters(p: URLSearchParams, keys: string[]): Filters {
  const allowed = new Set(['production', 'indicator', 'rule', 'version', ...keys]);
  for (const key of p.keys()) if (!allowed.has(key) || p.getAll(key).length !== 1) invalid();
  return { p_production: identifier(p, 'production'), p_indicator: identifier(p, 'indicator'),
    p_rule: identifier(p, 'rule'), p_version: identifier(p, 'version') };
}
export function parseMap(p: URLSearchParams): MapQuery {
  return { ...filters(p, ['date', 'bbox', 'zoom', 'limit']), p_date: date(p, 'date'), p_bbox: bbox(p),
    p_zoom: integer(p, 'zoom', 6, 0, 22), p_limit: integer(p, 'limit', 1000, 1, 2000) };
}
function range(p: URLSearchParams): { p_start: string; p_end: string } {
  const p_start = date(p, 'start'), p_end = date(p, 'end');
  const days = (Date.parse(p_end) - Date.parse(p_start)) / 86400000;
  if (days < 0 || days > 365) invalid();
  return { p_start, p_end };
}
export function parseSeries(p: URLSearchParams): SeriesQuery {
  return { ...filters(p, ['cell', 'start', 'end']), ...range(p), p_cell: identifier(p, 'cell') };
}
export function parseTerritory(p: URLSearchParams): TerritoryQuery {
  return { ...filters(p, ['bbox', 'start', 'end']), ...range(p), p_bbox: bbox(p) };
}
