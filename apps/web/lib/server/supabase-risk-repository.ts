import 'server-only';
import { ApiError, type MapQuery, type SeriesQuery, type TerritoryQuery } from './query';
import { validateMap, validateSeries, validateTerritory } from './response-validation';

export class SupabaseRiskRepository {
  constructor(private readonly transport: typeof fetch = fetch) {}

  private async rpc(name: string, parameters: MapQuery | SeriesQuery | TerritoryQuery): Promise<unknown> {
    // Lazy access: demo/build run without credentials. Never send these to browser code.
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!base || !secret) throw new ApiError('NOT_CONFIGURED', 503);
    let url: URL;
    try {
      url = new URL(base);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
        || url.pathname !== '/') throw new Error('Invalid URL');
      url.pathname = `/rest/v1/rpc/${name}`;
    } catch { throw new ApiError('NOT_CONFIGURED', 503); }
    try {
      const response = await this.transport(url, {
        method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000),
        // New Supabase secret keys belong in apikey, not in a JWT Authorization header.
        headers: { apikey: secret, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(parameters)
      });
      // Do not reflect upstream bodies, URLs, headers or exception messages.
      if (!response.ok) throw new ApiError('UPSTREAM_UNAVAILABLE', 502);
      return await response.json() as unknown;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('UPSTREAM_UNAVAILABLE', 502);
    }
  }
  async getMapFeatures(query: MapQuery) {
    return validateMap(await this.rpc('agriclimax_map_risks', query));
  }
  async getRiskSeries(query: SeriesQuery) {
    return validateSeries(await this.rpc('agriclimax_risk_series', query));
  }
  async getTerritoryRisks(query: TerritoryQuery) {
    return validateTerritory(await this.rpc('agriclimax_territory_risks', query));
  }
}
