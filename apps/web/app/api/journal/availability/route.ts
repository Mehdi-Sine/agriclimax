import { operationalEditions,sharedArchiveRead } from "../../../../lib/server/editorial-published";
import { parisDate } from "../../../../features/editorial/almanac";
export async function GET() {
  try {
    const today=parisDate(new Date().toISOString());
    const a=(await operationalEditions(today))[0]??(await operationalEditions())[0];
    return Response.json({status:!a?"absent":a.date===today?"available":"delayed",
      edition_id:a?.edition_id??null,date:a?.date??null,checksum:a?.checksum??null,storage:a&&sharedArchiveRead(a.edition_id)?"shared_archive":"retained_copy"},
      {headers:{"Cache-Control":"no-store"}});
  } catch { return Response.json({status:"error"},{status:503}); }
}
