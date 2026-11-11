import {manualMaps,manualCatalogue} from "../../../lib/server/manual-journal";
export async function GET(request:Request) {
 if(!process.env.AGRICLIMAX_MANUAL_RUN_DIR)return Response.json({status:"not_configured"},{status:404});
 try{
  const id=new URL(request.url).searchParams.get('map');
  const value=id?manualMaps().find(m=>m.id===id):manualCatalogue();
  return Response.json(value??{status:"absent"},{status:value?200:404,headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({status:'invalid_test_artifact'},{status:503});}
}
