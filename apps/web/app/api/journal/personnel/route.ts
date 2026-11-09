import {personalAccess,personalAccessDenied} from "../../../../lib/personal-access";
import {personalEditions} from "../../../../lib/server/editorial-personal";
export async function GET(request:Request) {
 if(!personalAccess(request.headers)) return personalAccessDenied();
 const u=new URL(request.url);
 const a=(await personalEditions()).find(a=>(!u.searchParams.get("id")||a.edition_id===u.searchParams.get("id"))&&(!u.searchParams.get("date")||a.date===u.searchParams.get("date")));
 if(!a) return Response.json({status:"absent"},{status:404,headers:{"Cache-Control":"private, no-store"}});
 return Response.json(a,{headers:{"Cache-Control":"private, no-store","X-Robots-Tag":"noindex"}});
}
