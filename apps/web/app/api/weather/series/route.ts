import { readStationWeather } from '../../../../lib/server/station-weather';

export async function GET(request: Request) {
  return readStationWeather(request, 'series');
}
