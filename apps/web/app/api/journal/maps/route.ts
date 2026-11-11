import {operationalEditions} from "../../../../lib/server/editorial-published";
import {editionMaps} from "../../../../lib/server/edition-maps";
export async function GET(request:Request){
  const p=new URL(request.url).searchParams,id=p.get("id"),mapId=p.get("map");
  const headers={"Cache-Control":"no-store"};
  if(!id||!/^[a-f0-9]{64}$/.test(id)||mapId!==null&&!/^[a-f0-9]{64}$/.test(mapId))return Response.json({status:"absent",code:"MAP_EDITION_ID"},{status:400,headers});
  try{
    const edition=(await operationalEditions()).find(a=>a.edition_id===id);
    if(!edition)return Response.json({status:"absent",code:"EDITION_NOT_FOUND"},{status:404,headers});
    const {view,bundle}=await editionMaps(edition);
    if(!mapId)return Response.json({edition_id:id,edition_checksum:edition.checksum,...view},{headers});
    const map=bundle?.maps.find(m=>m.id===mapId);
    if(!map)return Response.json({status:view.status,code:view.code},{status:view.status==="error"?503:404,headers});
    return Response.json({map,edition_id:id,edition_checksum:edition.checksum,bundle_sha256:bundle!.sha256,publication_state:view.status},{headers:{"Cache-Control":view.status==="published"?"public, max-age=31536000, immutable":"no-store",ETag:`"${map.id}"`}});
  }catch{return Response.json({status:"error",code:"MAP_ARCHIVE_UNAVAILABLE"},{status:503,headers});}
}
