import { operationalEditions } from "../../../../lib/server/editorial-published";
import { parisDate } from "../../../../features/editorial/almanac";
export async function GET() {
  try {
    const editions=await operationalEditions();
    const a=editions[0];
    return Response.json({status:!a?"absent":a.date===parisDate(new Date().toISOString())?"available":"delayed",
      edition_id:a?.edition_id??null,date:a?.date??null,checksum:a?.checksum??null},
      {headers:{"Cache-Control":"no-store"}});
  } catch { return Response.json({status:"error"},{status:503}); }
}
