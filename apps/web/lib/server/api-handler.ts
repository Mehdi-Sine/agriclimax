import 'server-only';
import { ApiError, parseMap, parseSeries, parseTerritory, type QueryKind } from './query';
import { SupabaseRiskRepository } from './supabase-risk-repository';

const messages = {
  INVALID_QUERY: 'Paramètres de requête invalides.',
  NOT_CONFIGURED: 'Service de données non configuré.',
  UPSTREAM_UNAVAILABLE: 'Service de données indisponible.',
  INVALID_RESPONSE: 'Réponse de données invalide.'
};
export async function readRisks(request: Request, kind: QueryKind,
  repository: SupabaseRiskRepository = new SupabaseRiskRepository()): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  try {
    const p = new URL(request.url).searchParams;
    const data = kind === 'map' ? await repository.getMapFeatures(parseMap(p))
      : kind === 'series' ? await repository.getRiskSeries(parseSeries(p))
        : await repository.getTerritoryRisks(parseTerritory(p));
    return Response.json(data, { headers });
  } catch (error) {
    const safe = error instanceof ApiError ? error : new ApiError('UPSTREAM_UNAVAILABLE', 502);
    return Response.json({ error: { code: safe.code, message: messages[safe.code] } },
      { status: safe.status, headers });
  }
}
