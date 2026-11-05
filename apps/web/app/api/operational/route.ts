import 'server-only';
import {completeForecastCycle,type WeatherCycle} from '../../../features/operational/model';
import cycle from '../../../data/operational/cycle.json';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import schema from '../../../../../contracts/jsonschema/pra-weather-1.schema.json';
const ajv=new Ajv2020({strict:false});addFormats(ajv);
const validate=ajv.compile(schema);
export async function GET(request:Request) {
  const params=new URL(request.url).searchParams;
  if(params.get('experimental')!=='weather'||[...params.keys()].some(k=>k!=='experimental')||params.getAll('experimental').length!==1)
    return Response.json({error:'EXPERIMENTAL_OPT_IN_REQUIRED'},{status:400});
  if(!cycle.run||!cycle.rows.length)return Response.json({error:'NO_VERIFIED_CYCLE'},{status:503});
  if(!cycle.rows.every(r=>validate(r))||!completeForecastCycle(cycle as WeatherCycle))return Response.json({error:'INVALID_CYCLE'},{status:503});
  return Response.json(cycle,{headers:{'Cache-Control':'no-store'}});
}
