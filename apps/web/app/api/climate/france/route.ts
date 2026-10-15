import { readFranceClimate } from '../../../../lib/server/france-climate';

export async function GET(request: Request) {
  return readFranceClimate(request);
}
