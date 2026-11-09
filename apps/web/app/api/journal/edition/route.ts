import { operationalEditions } from "../../../../lib/server/editorial-published";
export async function GET(request: Request) {
  const u=new URL(request.url), id=u.searchParams.get("id"), date=u.searchParams.get("date");
  const a=(await operationalEditions()).find(a=>(!id||a.edition_id===id)&&(!date||a.date===date));
  if(!a) return Response.json({status:"absent"},{status:404});
  const etag=`"${a.checksum}"`;
  if(request.headers.get("if-none-match")===etag) return new Response(null,{status:304,headers:{ETag:etag}});
  return Response.json(a,{headers:{ETag:etag,"Cache-Control":"no-store"}});
}
