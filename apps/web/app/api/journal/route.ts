import {journal} from '../../../lib/server/journal';
import {isJournalRun} from '../../../features/journal/query';
export const runtime='nodejs';
export const maxDuration=30;
export async function GET(request:Request){
 const params=new URL(request.url).searchParams,run=params.get('run');
 if([...params.keys()].some(k=>k!=='run'||params.getAll(k).length!==1)||params.has('run')&&(!run||!isJournalRun(run)))return Response.json({error:'INVALID_QUERY'},{status:400});
 try{const data=await journal(run??undefined),etag=JSON.stringify(`${data.edition_id}/${data.data_freshness}`),headers={'Cache-Control':'private, no-cache',ETag:etag};return request.headers.get('if-none-match')===etag?new Response(null,{status:304,headers}):Response.json(data,{headers});}
 catch{return Response.json({error:'VERIFIED_JOURNAL_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
