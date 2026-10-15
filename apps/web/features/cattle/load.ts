import 'server-only';
import { readStationWeather, SupabaseStationWeatherRepository, type StationBatch } from '../../lib/server/station-weather';
import { stationExposure } from './station';
export async function loadCattle(params: URLSearchParams, repository = new SupabaseStationWeatherRepository()) {
  const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
  const start = params.get('start') ?? params.get('date') ?? yesterday;
  const end = params.get('end') ?? start;
  const station = params.get('station') ?? '29075001';
  const product = params.get('product') ?? 'auto';
  const empty = {state: 'error' as const, station, start, end, product, results: [], stations: []};
  if (!['auto','climatology','observations'].includes(product)) return empty;
  async function read(source: string) {
    const query = new URLSearchParams({mode: 'live_meteofrance', station, start, end, product: source});
    const response = await readStationWeather(new Request(`https://internal/api/weather/series?${query}`), 'series', repository);
    if (!response.ok) return null;
    const {data} = await response.json() as {data: StationBatch[]}; // Shape validated by readStationWeather.
    return data;
  }
  if (product === 'auto') {
    const [hourly, daily, stations] = await Promise.all([read('observations'), read('climatology'), repository.stations()]);
    const hourlyResult = hourly ? stationExposure(hourly, station, start, end, 'hourly') : null;
    if (hourlyResult?.status === 'available') return {state: 'available' as const, station, start, end, product, stations, results: [hourlyResult]};
    if (!daily) return empty;
    const result = stationExposure(daily, station, start, end);
    result.quality_flags.push(hourly === null ? 'hourly_source_unavailable_daily_synthetic_used' : 'hourly_coverage_incomplete_daily_synthetic_used');
    return {state: 'available' as const, station, start, end, product, stations, results: [result]};
  }
  const [batches, stations] = await Promise.all([read(product), repository.stations()]);
  if (!batches) return empty;
  return {state: 'available' as const, station, start, end, product, stations,
    results: [stationExposure(batches, station, start, end, product === 'observations' ? 'hourly' : 'daily')]};
}
