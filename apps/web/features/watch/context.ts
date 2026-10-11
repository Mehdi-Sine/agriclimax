import type { AppContext, RiskLevel } from '../../lib/domain';
import { parseContext, serializeContext } from '../../lib/url-state';
import type { WatchFilters } from './server/repository';
import type { WatchRecord } from './model';
import { diagnosticHref } from '../../lib/diagnostic';

export const RISK_LEVELS: RiskLevel[] = ['low', 'moderate', 'high', 'critical', 'unavailable'];
export function watchFilters(params: URLSearchParams): WatchFilters {
  const risk = params.get('risk');
  return { ...parseContext(params), riskLevel: RISK_LEVELS.includes(risk as RiskLevel) ? risk as RiskLevel : null };
}
export function contextLink(context: AppContext, view: 'observation' | 'diagnostic', mode: string, extras: URLSearchParams): string {
  const params = serializeContext(context);
  if (view !== 'observation') params.set('view', view);
  params.set('mode', mode === 'live' ? 'live' : 'demo');
  for (const key of ['rule', 'version', 'bbox', 'zoom', 'limit']) {
    const value = extras.get(key);
    if (value) params.set(key, value);
  }
  return `/?${params}`;
}

/** Task 08 owns diagnostic routing, including exact cell/rule/version identity. */
export function signalDiagnosticLink(record: WatchRecord, context: AppContext, extras: URLSearchParams): string {
  const params = new URLSearchParams(contextLink(context, 'observation', record.bundle.mode, extras).split('?')[1]);
  return diagnosticHref(record.bundle.facts[0].result, record.bundle.mode, params);
}
