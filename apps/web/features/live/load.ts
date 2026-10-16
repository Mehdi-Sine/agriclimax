import 'server-only';
import { loadWheat, WheatRepository } from '../wheat/server';
import type { WheatPortfolio } from '../wheat/model';
import { loadCattle } from '../cattle/load';
import { SupabaseStationWeatherRepository, type WeatherStation } from '../../lib/server/station-weather';
import { liveContext } from './context';

export async function loadLive(context: ReturnType<typeof liveContext>) {
  let stations: WeatherStation[] = [], portfolios: WheatPortfolio[] = [];
  let cattle: Awaited<ReturnType<typeof loadCattle>> | null = null;
  let failure = '', catalogueFailure = false;
  if (!context.valid) return {stations, portfolios, cattle, failure:'Contexte invalide : production, indicateur, station et période terminée de 1 à 366 jours requis.', catalogueFailure};
  const repository = new SupabaseStationWeatherRepository();
  if (context.production === 'wheat') {
    const query = new URLSearchParams({mode:'wheat', start:context.start, end:context.end});
    // Keep all station results on the map; select a station only for detail.
    for (const key of ['stage','fingerprint']) if (context.query.has(key)) query.set(key, context.query.get(key)!);
    const [catalogue, results] = await Promise.allSettled([
      repository.stations(), loadWheat(query, new WheatRepository()),
    ]);
    if (catalogue.status === 'fulfilled') stations = catalogue.value;
    else catalogueFailure = true;
    if (results.status === 'fulfilled') portfolios = results.value;
    else failure = 'Calculs blé indisponibles ou contexte invalide. Aucun instantané ni fixture de remplacement.';
  } else {
    try {
      cattle = await loadCattle(context.query, repository);
      stations = cattle.stations;
      if (cattle.state === 'error') failure = 'Observations indisponibles ou contexte invalide. Aucun résultat de remplacement.';
    } catch { failure = 'Source Météo-France indisponible. Aucun résultat de remplacement.'; }
  }
  return {stations, portfolios, cattle, failure, catalogueFailure};
}
