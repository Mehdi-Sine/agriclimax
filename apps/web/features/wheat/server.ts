import 'server-only';
import {createHash} from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import schema from './portfolio.schema.json';
import defaults from './defaults.json';
import snapshots from './snapshots.json';
import { ApiError } from '../../lib/server/query';
import { INDICATORS, STAGES, type WheatPortfolio } from './model';

const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
const validate = ajv.compile<WheatPortfolio>(schema);
function invalid(): never { throw new ApiError('INVALID_QUERY', 400); }
function date(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000') || !Number.isFinite(Date.parse(value))
    || new Date(value).toISOString().slice(0,10) !== value) invalid();
  return value;
}
export function wheatQuery(params: URLSearchParams) {
  for (const key of params.keys()) if (!['mode','start','end','station','fingerprint','stage'].includes(key)
    || params.getAll(key).length !== 1) invalid();
  if (params.get('mode') !== 'wheat') invalid();
  const start = date(params.get('start') ?? '2026-09-01'), end = date(params.get('end') ?? '2026-09-03');
  if (end < start || (Date.parse(end)-Date.parse(start))/86400000 > 365 || end >= new Date().toISOString().slice(0,10)) invalid();
  const station = params.get('station') || null, fingerprint = params.get('fingerprint') ?? defaults.parameter_fingerprint;
  const stage = params.get('stage') || null;
  if ((station !== null && !/^\d{8}$/.test(station)) || !/^[a-f0-9]{64}$/.test(fingerprint)
    || (stage !== null && !Object.hasOwn(STAGES, stage))) invalid();
  return { p_start: start, p_end: end, p_station: station, p_fingerprint: fingerprint, p_stage: stage };
}

export class WheatRepository {
  constructor(private readonly transport: typeof fetch = fetch) {}
  async read(query: ReturnType<typeof wheatQuery>): Promise<WheatPortfolio[]> {
    const key = process.env.SUPABASE_SECRET_KEY, base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!key || !base) throw new ApiError('NOT_CONFIGURED',503);
    let url: URL;
    try {
      url = new URL(base);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
      url.pathname = '/rest/v1/rpc/agriclimax_wheat_portfolios';
    } catch { throw new ApiError('NOT_CONFIGURED',503); }
    let raw: unknown;
    try {
      const response = await this.transport(url, { method:'POST', cache:'no-store', redirect:'error',
        signal:AbortSignal.timeout(10000), headers:{apikey:key,'Content-Type':'application/json'}, body:JSON.stringify(query) });
      if (!response.ok) throw new Error();
      const text = await response.text();
      if (text.length > 8_000_000) throw new Error();
      raw = JSON.parse(text) as unknown;
    } catch { throw new ApiError('UPSTREAM_UNAVAILABLE',502); }
    return validatePortfolios(raw,query);
  }
}
export function validatePortfolios(raw:unknown, query:ReturnType<typeof wheatQuery>):WheatPortfolio[] {
    if (!Array.isArray(raw) || raw.length > 100) throw new ApiError('INVALID_RESPONSE',502);
    const stations = new Set<string>();
    return raw.map((item: unknown) => {
      if (!validate(item) || stations.has(item.station_id) || item.period.start !== query.p_start || item.period.end !== query.p_end
        || item.period.stage !== query.p_stage || item.parameter_fingerprint !== query.p_fingerprint
        || (query.p_station !== null && item.station_id !== query.p_station)
        || createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(item.parameters).sort(([a],[b])=>a.localeCompare(b))))).digest('hex') !== item.parameter_fingerprint
        || Date.parse(item.computed_at) > Date.now()+300000 || item.results.length !== 10
        || new Set(item.results.map(r => r.indicator)).size !== 10
        || item.results.some(r => !Object.hasOwn(INDICATORS,r.indicator) || r.rule_id !== `wheat.${r.indicator}`
          || Object.entries(r.period).some(([key,value])=>value!==item.period[key as keyof typeof item.period])
          || r.available_days > r.expected_days || r.expected_days !== (Date.parse(query.p_end)-Date.parse(query.p_start))/86400000+1
          || (r.value !== null && r.available_days !== r.expected_days))) throw new ApiError('INVALID_RESPONSE',502);
      stations.add(item.station_id);
      // A persisted result must age even when no new pipeline run happens.
      const stale = Date.now()-Date.parse(`${item.period.end}T00:00:00Z`) > 48*3600000;
      return { ...item, results:item.results.map(r => ({...r, freshness:stale ? 'stale' as const : r.freshness,
        data_freshness:stale ? 'stale' as const : r.data_freshness})) };
    });
}
export async function loadWheat(params: URLSearchParams, repository?: WheatRepository) {
  const query=wheatQuery(params);
  if (repository || process.env.WHEAT_STORAGE==='supabase') return (repository??new WheatRepository()).read(query);
  // Explicit server-side, real observation snapshots; never a fallback after an upstream error.
  const matching=snapshots.filter(p=>p.period.start===query.p_start && p.period.end===query.p_end
    && p.period.stage===query.p_stage && p.parameter_fingerprint===query.p_fingerprint
    && (query.p_station===null || p.station_id===query.p_station));
  return validatePortfolios(matching,query);
}
export async function readWheat(request: Request, repository?: WheatRepository) {
  const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  try { return Response.json({mode:'wheat', risk_computed:false, spatial_support:'station_points',
    data:await loadWheat(new URL(request.url).searchParams,repository)}, {headers}); }
  catch(error) {
    const safe = error instanceof ApiError ? error : new ApiError('UPSTREAM_UNAVAILABLE',502);
    return Response.json({error:{code:safe.code,message:'Portefeuille blé indisponible ou contexte invalide.'}}, {status:safe.status,headers});
  }
}
