import {isCalendarDate} from '../../../features/national/daily-availability';
import {nationalWatch} from '../../../lib/server/national-watch';
export const runtime='nodejs';
export const maxDuration=30;
export async function GET(request:Request){
 const params=new URL(request.url).searchParams,run=params.get('run');
 if(params.has('run')&&!run||[...params.keys()].some(k=>k!=='run'||params.getAll(k).length!==1)||run&&!(isCalendarDate(run)||/^\d{4}-\d{2}-\d{2}T(?:00|06|12|18):00:00(?:Z|\+00:00)$/.test(run)&&isCalendarDate(run.slice(0,10))&&Number.isFinite(Date.parse(run))))return Response.json({error:'INVALID_QUERY'},{status:400});
 try{return Response.json(await nationalWatch(run??undefined),{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({error:'VERIFIED_NATIONAL_WATCH_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
