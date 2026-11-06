import 'server-only';
import {
  NATIONAL,
  DAYS,
  VARIABLES,
  type ClimateContextRow,
  type ClimateVariable,
} from '../../features/national/model';
import { territoryData, type TerritoryRow } from './territories';
import { ApiError } from './query';
import {archivedEra5Day,type ArchivedDaily} from './weather-archives';
import { nationalAvailability, nationalDays } from './national-availability';
import { calendarDays, isCalendarDate, trailingStart, withinAvailable } from '../../features/national/daily-availability';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

async function supabaseRpc(
  name: string,
  body: JsonRecord,
  transport: typeof fetch,
): Promise<unknown> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!base || !secret) throw new ApiError('NOT_CONFIGURED', 503);
  let url: URL;
  try {
    url = new URL(base);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error();
    url.pathname = `/rest/v1/rpc/${name}`;
  } catch {
    throw new ApiError('NOT_CONFIGURED', 503);
  }
  try {
    const response = await transport(url, {
      method: 'POST',
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
      headers: {
        apikey: secret,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new ApiError('UPSTREAM_UNAVAILABLE', 502);
    const text = await response.text();
    if (text.length > 600_000) throw new ApiError('INVALID_RESPONSE', 502);
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('UPSTREAM_UNAVAILABLE', 502);
  }
}

export function parseContextRow(raw: unknown): ClimateContextRow {
  if (!isRecord(raw)) throw new ApiError('INVALID_RESPONSE', 502);
  // Stored PRA coverage follows pipeline.VARIABLES, independently of normal-column order.
  const index = ['temperature', 'temperature_min', 'temperature_max', 'precipitation'].indexOf(String(raw.variable));
  const coverage = raw.current_coverage;
  if (Array.isArray(coverage)) {
    if (index < 0 || coverage.length !== 4 || !coverage.every(v => v === null || typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1.0001)) throw new ApiError('INVALID_RESPONSE', 502);
    raw = { ...raw, current_coverage: coverage[index] };
  }
  if (!isRecord(raw)) throw new ApiError('INVALID_RESPONSE', 502);
  if (
    !validNumber(raw.current_value) ||
    !validNumber(raw.normal_1991_2020) ||
    !validNumber(raw.anomaly) ||
    !(raw.sample_years === null ||
      (typeof raw.sample_years === 'number' &&
        Number.isInteger(raw.sample_years))) ||
    !(typeof raw.expected_years === 'number' &&
      Number.isInteger(raw.expected_years)) ||
    !(raw.reference_coverage === null ||
      (typeof raw.reference_coverage === 'number' &&
        raw.reference_coverage >= 0 &&
        raw.reference_coverage <= 1)) ||
    !(raw.current_coverage === null ||
      (typeof raw.current_coverage === 'number' &&
        raw.current_coverage >= 0 &&
        raw.current_coverage <= 1.0001)) ||
    !['available', 'missing_current', 'missing_reference'].includes(
      String(raw.status),
    ) ||
    typeof raw.normal_status !== 'string'
  )
    throw new ApiError('INVALID_RESPONSE', 502);
  const variable = raw.variable;
  if (
    variable !== undefined &&
    !VARIABLES.some((v) => v.key === variable)
  )
    throw new ApiError('INVALID_RESPONSE', 502);
  return {
    ...(typeof raw.pra_id === 'string' ? { pra_id: raw.pra_id } : {}),
    ...(typeof raw.date === 'string' ? { date: raw.date } : {}),
    ...(variable ? { variable: variable as ClimateVariable } : {}),
    current_status:
      raw.current_status === null || typeof raw.current_status === 'string'
        ? (raw.current_status as string | null)
        : null,
    current_value: raw.current_value,
    normal_1991_2020: raw.normal_1991_2020,
    anomaly: raw.anomaly,
    sample_years: raw.sample_years as number | null,
    expected_years: raw.expected_years as number,
    reference_coverage: raw.reference_coverage as number | null,
    current_coverage: raw.current_coverage as number | null,
    status: raw.status as ClimateContextRow['status'],
    normal_status: raw.normal_status,
  };
}

async function nationalContextDay(
  date: string,
  variable: ClimateVariable,
  transport: typeof fetch,
) {
  const data: ClimateContextRow[] = [];
  let after = '';
  for (let page = 0; page < 8; page++) {
    const raw = await supabaseRpc(
      'agriclimax_pra_climatology_day_read',
      {
        p_release: NATIONAL.climatology,
        p_dataset: NATIONAL.dataset,
        p_date: date,
        p_variable: variable,
        p_after: after,
        p_limit: 100,
      },
      transport,
    );
    if (
      !isRecord(raw) ||
      raw.status !== 'available' ||
      !Array.isArray(raw.data) ||
      !(raw.next_cursor === null || typeof raw.next_cursor === 'string')
    )
      throw new ApiError('INVALID_RESPONSE', 502);
    const rows = raw.data.map(parseContextRow);
    if (
      rows.some(
        (row) =>
          !row.pra_id ||
          !/^pra:[0-9AB]{4,8}$/.test(row.pra_id) ||
          row.variable !== undefined,
      )
    )
      throw new ApiError('INVALID_RESPONSE', 502);
    data.push(...rows);
    after = raw.next_cursor || '';
    if (!after) break;
  }
  if (
    after ||
    data.length !== 713 ||
    new Set(data.map((r) => r.pra_id)).size !== 713
  )
    throw new ApiError('INVALID_RESPONSE', 502);
  return data;
}

async function nationalContextHistory(
  pra: string,
  transport: typeof fetch,
  days: string[] = DAYS,
) {
  const raw = await supabaseRpc(
    'agriclimax_pra_climatology_daily_read',
    {
      p_release: NATIONAL.climatology,
      p_dataset: NATIONAL.dataset,
      p_pra: pra,
      p_start: days[0],
      p_end: days.at(-1),
    },
    transport,
  );
  if (!isRecord(raw) || raw.status !== 'available' || !Array.isArray(raw.data))
    throw new ApiError('INVALID_RESPONSE', 502);
  const data = raw.data.map(parseContextRow);
  if (data.length !== days.length * VARIABLES.length)
    throw new ApiError('INVALID_RESPONSE', 502);
  if (new Set(data.map(r => `${r.date}:${r.variable}`)).size !== data.length) throw new ApiError('INVALID_RESPONSE', 502);
  for (const row of data) {
    if (
      !row.date ||
      !days.includes(row.date) ||
      !row.variable ||
      !VARIABLES.some((v) => v.key === row.variable)
    )
      throw new ApiError('INVALID_RESPONSE', 502);
  }
  return data;
}

function archivedContext(data:ClimateContextRow[],archive:ArchivedDaily[],variable:ClimateVariable):ClimateContextRow[]{
  const lookup=new Map(archive.map(row=>[row.pra_id,row]));
  const index=['temperature','temperature_min','temperature_max','precipitation'].indexOf(variable);
  return data.map(row=>{
    const archived=lookup.get(row.pra_id!);if(!archived)throw new ApiError('INVALID_RESPONSE',502);
    const value=archived[variable];
    return {...row,current_value:value,current_status:archived.status,current_coverage:archived.coverage[index],anomaly:value===null||row.normal_1991_2020===null?null:Math.fround(value)-Math.fround(row.normal_1991_2020),status:value===null?'missing_current':row.normal_1991_2020===null?'missing_reference':'available'};
  });
}
function archivedNative(data:TerritoryRow[],archive:ArchivedDaily[]):TerritoryRow[]{
  const lookup=new Map(archive.map(row=>[row.pra_id,row]));
  return data.map(row=>{
    const saved=lookup.get(row.id);if(!saved)throw new ApiError('INVALID_RESPONSE',502);
    const empty=saved.valid_counts.every(v=>v===0)&&[saved.temperature,saved.temperature_min,saved.temperature_max,saved.precipitation].every(v=>v===null);
    return {...row,temperature:saved.temperature,temperature_min:saved.temperature_min,temperature_max:saved.temperature_max,precipitation:saved.precipitation,valid_date:saved.valid_date,coverage:saved.coverage,valid_counts:saved.valid_counts,expected_cells:saved.expected_cells,status:empty?'unavailable':saved.status,quality_flags:saved.quality_flags,batch_key:saved.batch_key,computed_at:saved.computed_at,freshness:Date.now()-Date.parse(saved.valid_date)>6*86400000?'stale':'recent_reanalysis'};
  });
}

export async function nationalData(
  params: URLSearchParams,
  transport: typeof fetch = fetch,
) {
  if (process.env.PRA_NATIONAL_ENABLED !== '1')
    throw new ApiError('NOT_CONFIGURED', 503);

  const action = params.get('action') || 'day';
  const date = params.get('date') || '';
  const pra = params.get('pra') || '';
  const variable = params.get('variable') || '';
  const forceCold=params.get('storage')==='cold';
  if(params.has('storage')&&!forceCold)throw new ApiError('INVALID_QUERY',400);

  const availableDays = await nationalDays(transport, [date || params.get('end') || NATIONAL.end]);
  const historyEnd = params.get('end') || NATIONAL.end;
  const historyDays = isCalendarDate(historyEnd) ? calendarDays(
    [NATIONAL.start,trailingStart(historyEnd, 30)].sort().at(-1)!, historyEnd) : [];

  const allowed =
    action === 'day'
      ? ['action', 'date','storage']
      : action === 'history'
        ? ['action', 'pra', 'end','storage']
        : action === 'context-day'
          ? ['action', 'date', 'variable','storage']
          : ['action', 'pra', 'end','storage'];

  if (
    !['day', 'history', 'context-day', 'context-history'].includes(action) ||
    [...params.keys()].some(
      (key) => !allowed.includes(key) || params.getAll(key).length !== 1,
    ) ||
    ((action === 'day' || action === 'context-day') &&
      !withinAvailable(date,availableDays)) ||
    ((action === 'history' || action === 'context-history') &&
      (!withinAvailable(historyEnd,availableDays) || !historyDays.length)) ||
    ((action === 'history' || action === 'context-history') &&
      !/^pra:[0-9AB]{4,8}$/.test(pra)) ||
    (action === 'context-day' &&
      !VARIABLES.some((v) => v.key === variable))
  )
    throw new ApiError('INVALID_QUERY', 400);

  if (action === 'context-day') {
    let data = await nationalContextDay(
      date,
      variable as ClimateVariable,
      transport,
    );
    let archiveUsed=false;
    if(transport===fetch&&(forceCold||data.every(row=>row.current_status===null))){const archived=await archivedEra5Day(date);if(archived){data=archivedContext(data,archived,variable as ClimateVariable);archiveUsed=true;}}
    return {
      storage:archiveUsed?'verified_cold_archive':'warm_database',
      reference_version: NATIONAL.reference,
      dataset_version: NATIONAL.dataset,
      climatology_release: NATIONAL.climatology,
      reference_period: [1991, 2020],
      source_id: 'era5-land',
      source_kind: 'reanalysis',
      scientific_status: 'exploratory',
      period: [date, date],
      variable,
      data,
    };
  }

  if (action === 'context-history') {
    let data = await nationalContextHistory(pra, transport, historyDays);
    const archivedDays:string[]=[];
    if(transport===fetch)for(const day of historyDays){
      if(!forceCold&&!data.filter(r=>r.date===day).every(r=>r.current_status===null))continue;
      const archived=await archivedEra5Day(day);if(!archived)continue;
      const byVariable=VARIABLES.flatMap(v=>archivedContext(data.filter(r=>r.date===day&&r.variable===v.key),archived,v.key));
      data=data.map(r=>r.date===day?byVariable.find(a=>a.variable===r.variable)??r:r);archivedDays.push(day);
    }
    return {
      archived_days:archivedDays,
      reference_version: NATIONAL.reference,
      dataset_version: NATIONAL.dataset,
      climatology_release: NATIONAL.climatology,
      reference_period: [1991, 2020],
      source_id: 'era5-land',
      source_kind: 'reanalysis',
      scientific_status: 'exploratory',
      period: [historyDays[0], historyEnd],
      pra,
      data,
    };
  }

  const base = {
    action: 'read',
    reference: NATIONAL.reference,
    dataset: NATIONAL.dataset,
  };
  const data: TerritoryRow[] = [];
  if (action === 'day') {
    let after = '';
    for (let page = 0; page < 8; page++) {
      const result = await territoryData(
        new URLSearchParams({
          ...base,
          date,
          scope: 'france',
          limit: '100',
          after,
        }),
        transport,
      );
      data.push(...result.data);
      after = result.next_cursor || '';
      if (!after) break;
    }
    if(transport===fetch&&(forceCold||data.every(r=>r.valid_date===null))){const archived=await archivedEra5Day(date);if(archived)data.splice(0,data.length,...archivedNative(data,archived));}
    if (
      after ||
      data.length !== 713 ||
      new Set(data.map((r) => r.id)).size !== 713
    )
      throw new ApiError('INVALID_RESPONSE', 502);
  } else {
    for (let i = 0; i < historyDays.length; i += 4) {
      const pages = await Promise.all(
        historyDays.slice(i, i + 4).map((day) =>
          territoryData(
            new URLSearchParams({
              ...base,
              date: day,
              scope: 'pra',
              id: pra,
              limit: '1',
            }),
            transport,
          ),
        ),
      );
      for (const [j, page] of pages.entries()) {
        if(transport===fetch&&(forceCold||page.data[0]?.valid_date===null)){const archived=await archivedEra5Day(historyDays[i+j]);if(archived)page.data=archivedNative(page.data,archived);}
        if (
          page.data.length !== 1 ||
          page.data[0].id !== pra ||
          page.data[0].valid_date !== historyDays[i + j]
        )
          throw new ApiError('INVALID_RESPONSE', 502);
        data.push(page.data[0]);
      }
    }
  }
  return {
    reference_version: NATIONAL.reference,
    dataset_version: NATIONAL.dataset,
    source_id: 'era5-land',
    source_kind: 'reanalysis',
    method_version: 'pra-native-1',
    period: action === 'day' ? [date, date] : [historyDays[0], historyEnd],
    data,
  };
}

export async function readNational(
  request: Request,
  transport: typeof fetch = fetch,
) {
  try {
    const params = new URL(request.url).searchParams;
    if (params.get('action') === 'availability') {
      if ([...params.keys()].some(k => k !== 'action' || params.getAll(k).length !== 1))
        throw new ApiError('INVALID_QUERY', 400);
      return Response.json(await nationalAvailability(transport),
        { headers: { 'Cache-Control': 'no-store' } });
    }
    return Response.json(
      await nationalData(params, transport),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const safe =
      error instanceof ApiError
        ? error
        : new ApiError('UPSTREAM_UNAVAILABLE', 502);
    return Response.json(
      { error: safe.code },
      { status: safe.status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
