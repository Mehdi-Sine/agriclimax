import {nationalWatch} from '../../../lib/server/national-watch';
export const runtime='nodejs';
export const maxDuration=30;
export async function GET(request:Request){
 if(new URL(request.url).search)return Response.json({error:'INVALID_QUERY'},{status:400});
 try{return Response.json(await nationalWatch(),{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({error:'VERIFIED_NATIONAL_WATCH_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
