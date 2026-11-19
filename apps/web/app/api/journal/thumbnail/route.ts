import {editionForecastRendering} from '../../../../lib/server/edition-forecast';
import {operationalEditions} from "../../../../lib/server/editorial-published";
import {editionMaps} from "../../../../lib/server/edition-maps";
import {coverageEnabledFor} from "../../../../features/cartography/coverage";
import {RECIPES} from "../../../../features/multiproduction/registry";
import {periodSupportDocument} from "../../../../lib/server/spatial-restitution";
import {mapThumbnail} from "../../../../lib/server/map-thumbnail";
import {THUMBNAIL_VERSION} from "../../../../features/edition-maps/carousel-model";
export const runtime = "nodejs";
const noStore = {"Cache-Control": "no-store"};
// The report can reuse an already-rendered published thumbnail. A cache miss
// returns immediately, without fetching a map or calling the image renderer.
const publishedThumbnails = new Map<string, Uint8Array>();
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams, id = p.get("id"), mapId = p.get("map");
  if (!id || !mapId || !/^[a-f0-9]{64}$/.test(id) || !/^[a-f0-9]{64}$/.test(mapId) || p.get("v") !== THUMBNAIL_VERSION)
    return Response.json({status: "absent", code: "THUMBNAIL_ID"}, {status: 400, headers: noStore});
  const key = `${id}/${mapId}`;
  if (p.get("cached") === "1") {
    const existing = publishedThumbnails.get(key);
    return existing ? new Response(new Uint8Array(existing), {headers:{...noStore,"Content-Type":"image/webp"}})
      : new Response(null, {status:404,headers:noStore});
  }
  try {
    const edition = (await operationalEditions()).find(e => e.edition_id === id);
    if (!edition) return Response.json({status: "absent"}, {status: 404, headers: noStore});
    const {view, bundle} = await editionMaps(edition), map = bundle?.maps.find(m => m.id === mapId);
    if (!map) return Response.json({status: view.status, code: view.code}, {status: view.status === "error" ? 503 : 404, headers: noStore});
    // Published rendering is frozen by the bundle version; rollout changes cannot repaint an archive.
    const exhaustive = map.rendering?.version === 'couv06-history-1' || (coverageEnabledFor(map.nature) && view.status === 'preview');
    const variables = RECIPES.find(r=>r.id===map.indicator)?.kernel.variables;
    const spatial = exhaustive && !map.rendering && map.nature==='reanalysis' && variables?.length===1 && variables[0]!=='humidity'
      ? await periodSupportDocument(map.period[0],map.period[1],variables[0]) : null;
    const rendering=exhaustive?await editionForecastRendering(map,view.status):undefined;
    const rendered=rendering?{...map,rows:map.rows.map(r=>({...r,quality:rendering.qualities[r.territoryId]}))}:map;
    const {bytes, etag} = await mapThumbnail(rendered,{exhaustive,coveredSupport:map.rendering?.covered_support??rendering?.collection??(spatial?.verified?spatial.collection:null)});
    if (view.status === "published" && !publishedThumbnails.has(key) && bytes.length <= 192*1024) {
      if (publishedThumbnails.size >= 24) publishedThumbnails.delete(publishedThumbnails.keys().next().value!);
      publishedThumbnails.set(key, bytes);
    }
    const headers = {"Content-Type": "image/webp", "X-Content-Type-Options": "nosniff", ETag: etag,
      "Cache-Control": view.status === "published" ? "public, max-age=86400, stale-while-revalidate=604800" : "no-store"};
    if (view.status === "published" && request.headers.get("if-none-match") === etag) return new Response(null, {status: 304, headers});
    return new Response(new Uint8Array(bytes), {headers});
  } catch {return Response.json({status: "error", code: "THUMBNAIL_UNAVAILABLE"}, {status: 503, headers: noStore});}
}
