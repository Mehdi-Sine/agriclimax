import { readWheat } from '../../../features/wheat/server';
export async function GET(request: Request) { return readWheat(request); }
