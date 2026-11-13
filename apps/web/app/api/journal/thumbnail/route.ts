import {operationalEditions} from "../../../../lib/server/editorial-published";
import {editionMaps} from "../../../../lib/server/edition-maps";
import {mapThumbnail} from "../../../../lib/server/map-thumbnail";
import {THUMBNAIL_VERSION} from "../../../../features/edition-maps/carousel-model";
export const runtime = "nodejs";
const noStore = {"Cache-Control": "no-store"};
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams, id = p.get("id"), mapId = p.get("map");
  if (!id || !mapId || !/^[a-f0-9]{64}$/.test(id) || !/^[a-f0-9]{64}$/.test(mapId) || p.get("v") !== THUMBNAIL_VERSION)
    return Response.json({status: "absent", code: "THUMBNAIL_ID"}, {status: 400, headers: noStore});
  try {
    const edition = (await operationalEditions()).find(e => e.edition_id === id);
    if (!edition) return Response.json({status: "absent"}, {status: 404, headers: noStore});
    const {view, bundle} = await editionMaps(edition), map = bundle?.maps.find(m => m.id === mapId);
    if (!map) return Response.json({status: view.status, code: view.code}, {status: view.status === "error" ? 503 : 404, headers: noStore});
    const {bytes, etag} = await mapThumbnail(map);
    const headers = {"Content-Type": "image/webp", "X-Content-Type-Options": "nosniff", ETag: etag,
      "Cache-Control": view.status === "published" ? "public, max-age=86400, stale-while-revalidate=604800" : "no-store"};
    if (view.status === "published" && request.headers.get("if-none-match") === etag) return new Response(null, {status: 304, headers});
    return new Response(new Uint8Array(bytes), {headers});
  } catch {return Response.json({status: "error", code: "THUMBNAIL_UNAVAILABLE"}, {status: 503, headers: noStore});}
}
