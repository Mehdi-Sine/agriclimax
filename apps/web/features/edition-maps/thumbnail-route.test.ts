import {it, expect, vi, beforeEach} from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("../cartography/coverage",async importOriginal=>({...await importOriginal<typeof import("../cartography/coverage")>(),coverageEnabledFor:vi.fn().mockReturnValue(false)}));
import {coverageEnabledFor} from "../cartography/coverage";
vi.mock("../../lib/server/editorial-published",()=>({operationalEditions:vi.fn()}));
vi.mock("../../lib/server/edition-maps",()=>({editionMaps:vi.fn()}));
import {operationalEditions} from "../../lib/server/editorial-published";
import {editionMaps} from "../../lib/server/edition-maps";
import {GET} from "../../app/api/journal/thumbnail/route";
import {readArchivedMaps} from "../../../../scripts/edit03_archives";
import {consultableEdition} from "../editorial-ai/consultable";
import {mapInfo} from "./model";
const {archive,bundle}=readArchivedMaps("2026-11-13"), edition=consultableEdition(archive);
const query=`id=${edition.edition_id}&map=${bundle.maps[0].id}&v=ux03-1`;
const request=(q=query,headers?:HeadersInit)=>new Request(`https://example.invalid/api/journal/thumbnail?${q}`,{headers});
beforeEach(()=>{vi.resetAllMocks();vi.mocked(operationalEditions).mockResolvedValue([edition]);vi.mocked(editionMaps).mockResolvedValue({bundle,view:{status:"published",code:"MAP_PUBLISHED",bundle_sha256:bundle.sha256,maps:bundle.maps.map(mapInfo)}});});
it("returns only existing published thumbnail bytes on a cache-only request",async()=>{
 const cachedQuery=query+"&cached=1";
 expect((await GET(request(cachedQuery))).status).toBe(404);
 expect(operationalEditions).not.toHaveBeenCalled();
 const rendered=await GET(request());
 const reuse=await GET(request(cachedQuery));
 expect(reuse.status).toBe(200);
 expect(Buffer.from(await reuse.arrayBuffer())).toEqual(Buffer.from(await rendered.arrayBuffer()));
 expect(operationalEditions).toHaveBeenCalledTimes(1);
});
it("serves a cacheable raster and supports conditional revalidation",async()=>{
 const r=await GET(request());expect(r.status).toBe(200);expect(r.headers.get("content-type")).toBe("image/webp");expect(r.headers.get("cache-control")).toContain("public");
 expect((await r.arrayBuffer()).byteLength).toBeLessThan(50000);
 const cached=await GET(request(query,{"if-none-match":r.headers.get("etag")!}));expect(cached.status).toBe(304);
});
it("never caches unpublished candidates or errors",async()=>{
 vi.mocked(editionMaps).mockResolvedValue({bundle,view:{status:"preview",code:"MAP_REVIEW_REQUIRED",maps:bundle.maps.map(mapInfo)}});
 expect((await GET(request())).headers.get("cache-control")).toBe("no-store");
 vi.mocked(editionMaps).mockResolvedValue({view:{status:"error",code:"MAP_ARCHIVE_UNAVAILABLE_OR_INVALID",maps:[]}});
 const r=await GET(request());expect(r.status).toBe(503);expect(r.headers.get("cache-control")).toBe("no-store");
});
it("rejects invalid or cross-edition identifiers and never substitutes a recent map",async()=>{
 expect((await GET(request("id=../../secret&map=bad&v=ux03-1"))).status).toBe(400);expect(operationalEditions).not.toHaveBeenCalled();
 expect((await GET(request(query.replace(edition.edition_id,"0".repeat(64))))).status).toBe(404);
 expect((await GET(request(query.replace(bundle.maps[0].id,"0".repeat(64))))).status).toBe(404);
 expect((await GET(request(query.replace("ux03-1","old")))).status).toBe(400);
});

it("keeps published legacy rasters byte-identical with the historical rollout on",async()=>{
 vi.mocked(coverageEnabledFor).mockReturnValue(false);
 const before=await GET(request()),a=await before.arrayBuffer();
 vi.mocked(coverageEnabledFor).mockReturnValue(true);
 const after=await GET(request());
 expect(after.headers.get("etag")).toBe(before.headers.get("etag"));
 expect(Buffer.from(await after.arrayBuffer())).toEqual(Buffer.from(a));
});

it("keeps new published rendering frozen when the rollout switch is removed",async()=>{
 const original=bundle.maps.find(m=>m.nature==='reanalysis')!;
 const enhanced={...original,rendering:{version:'couv06-history-1' as const,covered_support:{type:'FeatureCollection' as const,features:[]}}};
 const replacement={...bundle,maps:[enhanced]};
 vi.mocked(editionMaps).mockResolvedValue({bundle:replacement,view:{status:'published',code:'MAP_PUBLISHED',maps:replacement.maps.map(mapInfo)}});
 const q=`id=${edition.edition_id}&map=${enhanced.id}&v=ux03-1`;
 vi.mocked(coverageEnabledFor).mockReturnValue(true);
 const before=await GET(request(q)),a=await before.arrayBuffer();
 vi.mocked(coverageEnabledFor).mockReturnValue(false);
 const after=await GET(request(q));
 expect(after.status).toBe(200);
 expect(after.headers.get('etag')).toBe(before.headers.get('etag'));
 expect(Buffer.from(await after.arrayBuffer())).toEqual(Buffer.from(a));
});
