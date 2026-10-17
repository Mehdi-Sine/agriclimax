import {readTerritories} from '../../../lib/server/territories';
export async function GET(request:Request) {return readTerritories(request);}
