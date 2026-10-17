import {readPraDiagnostics} from '../../../../lib/server/pra-diagnostics';
export async function GET(request:Request) {return readPraDiagnostics(request);}
