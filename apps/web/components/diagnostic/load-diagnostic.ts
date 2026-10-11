import 'server-only';
import fixture from '../../../../fixtures/contracts/risk-result.json';
import type { DiagnosticData, DiagnosticResult } from '../../lib/diagnostic';
import { parseSeries, ApiError } from '../../lib/server/query';
import { SupabaseRiskRepository } from '../../lib/server/supabase-risk-repository';
import { validateSeries } from '../../lib/server/response-validation';

export async function loadDiagnostic(params: URLSearchParams, repository = new SupabaseRiskRepository()): Promise<DiagnosticData> {
  const mode = params.get('mode') === 'live' ? 'live' : 'demo';
  try {
    if (params.has('mode') && !['live', 'demo'].includes(params.get('mode')!)) throw new ApiError('INVALID_QUERY', 400);
    const query = new URLSearchParams();
    for (const key of ['production', 'indicator', 'rule', 'version', 'cell'])
      for (const value of params.getAll(key)) query.append(key, value);
    for (const key of ['date', 'start', 'end', 'mode'])
      if (params.getAll(key).length > 1) throw new ApiError('INVALID_QUERY', 400);
    query.set('start', params.get('start') ?? params.get('date') ?? '');
    query.set('end', params.get('end') ?? params.get('date') ?? '');
    const parsed = parseSeries(query);
    // Validate selected date independently, and require it to belong to the requested range.
    parseSeries(new URLSearchParams({ ...Object.fromEntries(query), start: params.get('date') ?? '', end: params.get('date') ?? '' }));
    const date = params.get('date')!;
    if (date < parsed.p_start || date > parsed.p_end) throw new ApiError('INVALID_QUERY', 400);
    const raw = mode === 'live' ? await repository.getRiskSeries(parsed) : validateSeries([fixture]);
    // Both repository and fixture pass the V1 JSON Schema before this read-only projection.
    const series = (raw as unknown as DiagnosticResult[]).filter(result =>
      result.cell_id === parsed.p_cell && result.production_id === parsed.p_production &&
      result.indicator_id === parsed.p_indicator && result.rule.rule_id === parsed.p_rule &&
      result.rule.version === parsed.p_version && result.valid_date >= parsed.p_start && result.valid_date <= parsed.p_end
    ).sort((a, b) => a.valid_date.localeCompare(b.valid_date));
    if (new Set(series.map(result => result.valid_date)).size !== series.length) throw new ApiError('INVALID_RESPONSE', 502);
    const selected = series.filter(result => result.valid_date === date);
    return selected[0] ? { mode, state: 'available', result: selected[0], series }
      : { mode, state: 'missing', message: 'Aucun résultat pour cet identifiant, cette date et cette version de règle.' };
  } catch (error) {
    const message = error instanceof ApiError && error.code === 'INVALID_QUERY'
      ? 'Identifiant incomplet ou invalide : cellule, production, indicateur, règle, version et date sont requis ; période maximale de 365 jours.'
      : error instanceof ApiError && error.code === 'NOT_CONFIGURED' ? 'Service live non configuré.'
      : 'Lecture du diagnostic impossible. Aucun résultat de remplacement.';
    return { mode, state: 'source-error', message };
  }
}
