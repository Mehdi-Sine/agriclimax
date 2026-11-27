import { operationalEditions } from "../../../../lib/server/editorial-published";
export async function GET(request: Request) {
  const u=new URL(request.url), id=u.searchParams.get("id"), date=u.searchParams.get("date");
  const a=(await operationalEditions(date||undefined)).find(a=>(!id||a.edition_id===id)&&(!date||a.date===date));
  if(!a) return Response.json({status:"absent"},{status:404,headers:{"Cache-Control":"no-store"}});
  const etag=`"${a.content_sha256}"`;
  const headers={ETag:etag,"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"};
  if(request.headers.get("if-none-match")===etag) return new Response(null,{status:304,headers});
  return Response.json(a,{headers});
}
