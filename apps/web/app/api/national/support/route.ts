import {supportDocument,validSupportQuery} from '../../../../lib/server/spatial-restitution';
import {isCalendarDate} from '../../../../features/national/daily-availability';
export const runtime='nodejs';
export async function GET(request:Request){const p=new URL(request.url).searchParams;if(!validSupportQuery(p)||!isCalendarDate(p.get('date')!))return Response.json({error:'INVALID_QUERY'},{status:400});return Response.json(await supportDocument(p.get('date')!,p.get('variable')!),{headers:{'Cache-Control':'private, max-age=300'}});}
