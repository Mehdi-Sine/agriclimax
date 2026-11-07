import {watchResponse} from '../../../../lib/server/watch-response';
import {historicalWatch} from '../../../../lib/server/historical-watch';
export const runtime='nodejs';
export const maxDuration=30;
export async function GET(request:Request){
 if(new URL(request.url).search)return Response.json({error:'INVALID_QUERY'},{status:400});
 try{return watchResponse(request,await historicalWatch());}
 catch{return Response.json({error:'VERIFIED_HISTORY_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
