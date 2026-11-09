import { operationalEditions } from "../../../../lib/server/editorial-published";
export async function GET(request: Request) {
  const u=new URL(request.url);
  const a=(await operationalEditions()).find(a=>a.edition_id===u.searchParams.get("id"));
  const map=a?.illustrations.find(m=>m.id===u.searchParams.get("map")&&a.draft.illustration_ids.includes(m.id));
  if(!map) return Response.json({status:"absent"},{status:404});
  return Response.json(map.data,{headers:{ETag:`"${map.sha256}"`,"Cache-Control":"public, max-age=31536000, immutable"}});
}
