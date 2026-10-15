import 'server-only';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { ApiError } from './query';

const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
const nullable = (minimum: number, maximum: number) => ({ type: ['number', 'null'], minimum, maximum });
interface GridRow {
  cell_id: string; valid_date: string; longitude: number; latitude: number;
  temperature: number | null; temperature_min: number | null; temperature_max: number | null;
  precipitation: number | null; quality_flags: string[]; acquisition_key: string;
}
interface GridPage { support: 'era5_land_grid'; interpolation: 'none'; data: GridRow[]; next_cursor: string | null }
const validator = ajv.compile<GridPage>({ type: 'object', additionalProperties: false,
  required: ['support', 'interpolation', 'data', 'next_cursor'], properties: {
    support: { const: 'era5_land_grid' }, interpolation: { const: 'none' },
    next_cursor: { type: ['string', 'null'], maxLength: 100 },
    data: { type: 'array', maxItems: 1000, items: { type: 'object', additionalProperties: false,
      required: ['cell_id', 'valid_date', 'longitude', 'latitude', 'temperature', 'temperature_min',
        'temperature_max', 'precipitation', 'quality_flags', 'acquisition_key'], properties: {
        cell_id: { type: 'string', pattern: '^era5land\\.[-0-9.]+$' },
        valid_date: { type: 'string', format: 'date' }, longitude: { type: 'number', minimum: -6, maximum: 10 },
        latitude: { type: 'number', minimum: 41, maximum: 52 },
        temperature: nullable(-100, 70), temperature_min: nullable(-100, 70), temperature_max: nullable(-100, 70),
        precipitation: nullable(0, 3000), quality_flags: { type: 'array', maxItems: 30, items: { type: 'string' } },
        acquisition_key: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      } } },
  } });

export async function readFranceClimate(request: Request, transport: typeof fetch = fetch) {
  try {
    const params = new URL(request.url).searchParams;
    for (const key of params.keys()) if (!['version', 'date', 'after', 'limit'].includes(key)
      || params.getAll(key).length !== 1) throw new ApiError('INVALID_QUERY', 400);
    const version = params.get('version') || '';
    const date = params.get('date') || '';
    const after = params.get('after') || '';
    const limit = params.get('limit') || '1000';
    if (!/^[A-Za-z0-9_.-]{1,100}$/.test(version) || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || date.startsWith('0000') || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))
      || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
      || (after !== '' && !/^era5land\.[-0-9.]{1,80}$/.test(after))
      || !/^\d{1,4}$/.test(limit) || Number(limit) < 1 || Number(limit) > 1000)
      throw new ApiError('INVALID_QUERY', 400);
    const key = process.env.SUPABASE_SECRET_KEY;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!key || !base) throw new ApiError('NOT_CONFIGURED', 503);
    let url: URL;
    try {
      url = new URL(base);
      if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/'
        || url.search || url.hash) throw new Error();
    } catch { throw new ApiError('NOT_CONFIGURED', 503); }
    url.pathname = '/rest/v1/rpc/agriclimax_france_map';
    const response = await transport(url, { method: 'POST', cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(8000), headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_version: version, p_date: date, p_after: after, p_limit: Number(limit) }) });
    if (!response.ok) throw new ApiError('UPSTREAM_UNAVAILABLE', 502);
    const text = await response.text();
    if (text.length > 2_000_000) throw new ApiError('INVALID_RESPONSE', 502);
    const value: unknown = JSON.parse(text);
    if (!validator(value) || value.data.length > Number(limit)
      || value.data.some((row, i) => row.valid_date !== date || row.cell_id <= after
        || (i > 0 && row.cell_id <= value.data[i - 1].cell_id))
      || (value.next_cursor !== null && value.next_cursor !== value.data.at(-1)?.cell_id))
      throw new ApiError('INVALID_RESPONSE', 502);
    return Response.json({ ...value, source_id: 'era5-land', resolution: '0.1 degree', dataset_version: version, units: {
      temperature: 'degC', temperature_min: 'degC', temperature_max: 'degC', precipitation: 'mm' },
      risk_computed: false, state: value.data.length ? 'available' : 'absent' },
    { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const safe = error instanceof ApiError ? error : new ApiError('UPSTREAM_UNAVAILABLE', 502);
    return Response.json({ error: safe.code }, { status: safe.status });
  }
}
