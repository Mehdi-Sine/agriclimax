import {personalAccess,personalAccessDenied} from "../../../../../lib/personal-access";
import {personalEditions} from "../../../../../lib/server/editorial-personal";
export async function GET(request:Request) {
 if(!personalAccess(request.headers)) return personalAccessDenied();
 const u=new URL(request.url),a=(await personalEditions()).find(a=>a.edition_id===u.searchParams.get("id"));
 const map=a?.illustrations.find(m=>m.id===u.searchParams.get("map")&&a.draft.illustration_ids.includes(m.id));
 if(!map) return Response.json({status:"absent"},{status:404});
 return Response.json(map.data,{headers:{"Cache-Control":"private, no-store","X-Robots-Tag":"noindex"}});
}
