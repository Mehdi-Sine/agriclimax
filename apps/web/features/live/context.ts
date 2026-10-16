import { INDICATORS, STAGES } from '../wheat/model';

export type LiveView = 'observation' | 'diagnostic' | 'history' | 'watch';
export const VIEWS: Record<LiveView, string> = { observation: 'Carte', diagnostic: 'Diagnostic', history: 'Historique', watch: 'Veille' };
export const CATTLE_INDICATORS: Record<string, string> = { thi: 'THI · maximum observé', days_above: 'Jours avec dépassement THI > 72', episodes: 'Épisodes THI > 72' };
export function isLiveWorkspace(params: URLSearchParams) {
  // Keep the existing explicit, versioned RiskResult route available.
  if (params.get('mode') === 'live' && params.has('rule')) return false;
  return !params.has('mode') || params.get('mode') === 'live' || params.get('mode') === 'live_meteofrance';
}
export function liveContext(params: URLSearchParams) {
  const production = params.get('production') ?? 'wheat';
  const indicators = production === 'cattle' ? CATTLE_INDICATORS : INDICATORS;
  const indicator = params.get('indicator') ?? (production === 'cattle' ? 'thi' : 'gdd');
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const start = params.get('start') ?? params.get('date') ?? yesterday;
  const end = params.get('end') ?? start;
  const station = params.get('station') || null;
  const product = params.get('product') ?? 'auto';
  const calendar = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !s.startsWith('0000') && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
  const valid = ['wheat','cattle'].includes(production) && Object.hasOwn(indicators, indicator)
    && calendar(start) && calendar(end) && start <= end && end < new Date().toISOString().slice(0,10)
    && (Date.parse(end)-Date.parse(start))/86400000 <= 365
    && (station === null || /^\d{8}$/.test(station)) && ['auto','observations','climatology'].includes(product)
    && (!params.get('stage') || Object.hasOwn(STAGES,params.get('stage')!))
    && (!params.has('fingerprint') || /^[a-f0-9]{64}$/.test(params.get('fingerprint')!))
    && [...params.keys()].every(key => params.getAll(key).length === 1);
  const query = new URLSearchParams({mode:'live_meteofrance', production, indicator, start, end});
  if (station) query.set('station', station);
  if (production === 'cattle') query.set('product', product);
  for (const key of ['stage','fingerprint']) if (params.has(key)) query.set(key, params.get(key)!);
  return { production, indicator, indicators, start, end, station, product, valid, query };
}
export function liveHref(view: LiveView, query: URLSearchParams, station?: string) {
  const next = new URLSearchParams(query);
  if (station) next.set('station', station);
  return `${view === 'observation' ? '/' : `/${view}`}?${next}`;
}
