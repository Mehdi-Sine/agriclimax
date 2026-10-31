import { readNational } from '../../../lib/server/national';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function GET(request: Request) {
  return readNational(request);
}
