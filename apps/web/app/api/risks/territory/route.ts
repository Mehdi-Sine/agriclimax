import { readRisks } from '../../../../lib/server/api-handler';
export const runtime = 'nodejs';
export async function GET(request: Request): Promise<Response> { return readRisks(request, 'territory'); }
