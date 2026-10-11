import type { AppContext, RiskLevel } from '../../lib/domain';
import { parseContext, serializeContext } from '../../lib/url-state';
import type { WatchFilters } from './server/repository';

export const RISK_LEVELS: RiskLevel[] = ['low', 'moderate', 'high', 'critical', 'unavailable'];
export function watchFilters(params: URLSearchParams): WatchFilters {
  const risk = params.get('risk');
  return { ...parseContext(params), riskLevel: RISK_LEVELS.includes(risk as RiskLevel) ? risk as RiskLevel : null };
}
export function contextLink(context: AppContext, view: 'observation' | 'diagnostic', mode: string, extras: URLSearchParams): string {
  const params = serializeContext(context);
  if (view !== 'observation') params.set('view', view);
  if (mode === 'live') {
    params.set('mode', 'live');
    for (const key of ['rule', 'version', 'bbox', 'zoom', 'limit']) {
      const value = extras.get(key);
      if (value) params.set(key, value);
    }
  }
  return `/?${params}`;
}
