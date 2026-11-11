import {it,expect,vi,beforeEach} from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("../../lib/server/editorial-published",()=>({operationalEditions:vi.fn()}));
vi.mock("../../lib/server/edition-maps",()=>({editionMaps:vi.fn()}));
import {operationalEditions} from "../../lib/server/editorial-published";
import {editionMaps} from "../../lib/server/edition-maps";
import {GET} from "../../app/api/journal/maps/route";
import {unpackConsultable,verifyConsultable} from "../editorial-ai/consultable";
import bootstrap from "../../data/editorial/consultable-bootstrap.json";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {mapInfo,type EditionMapBundle} from "./model";
const bundle=JSON.parse(gunzipSync(readFileSync(new URL("../../../../docs/codex/INT-01/evidence/real-map-bundle.json.gz",import.meta.url))).toString()) as EditionMapBundle;
// Actual public projection of the real November 11 revision; no provider receipt.
const editions=[verifyConsultable(JSON.parse(readFileSync(new URL("../../../../docs/codex/INT-01/evidence/consultable-edition.json",import.meta.url),"utf8"))),...unpackConsultable(bootstrap)];
const edition=editions.find(e=>e.edition_id===bundle.edition_id)!;
const request=(query:string)=>new Request(`https://example.invalid/api/journal/maps?${query}`);
beforeEach(()=>{vi.resetAllMocks();vi.mocked(operationalEditions).mockResolvedValue(editions);});
it("returns one shared, checksum-bound catalogue and exact structured data without private receipts",async()=>{
  vi.mocked(editionMaps).mockResolvedValue({bundle,view:{status:"published",code:"MAP_PUBLISHED",bundle_sha256:bundle.sha256,maps:bundle.maps.map(mapInfo)}});
  const catalogue=await GET(request(`id=${edition.edition_id}`));
  expect((await catalogue.json()).maps).toHaveLength(10);
  const r=await GET(request(`id=${edition.edition_id}&map=${bundle.maps[0].id}`)),json=await r.json();
  expect(r.status).toBe(200);expect(r.headers.get("cache-control")).toContain("immutable");
  expect(json.map).toEqual(bundle.maps[0]);expect(json.edition_checksum).toBe(edition.checksum);
  expect(JSON.stringify(json)).not.toMatch(/"(?:receipt|parameters|response_id|apikey)":/);
});
it("never caches an unpublished candidate as an operational map",async()=>{
  vi.mocked(editionMaps).mockResolvedValue({bundle,view:{status:"preview",code:"MAP_REVIEW_REQUIRED",bundle_sha256:bundle.sha256,maps:bundle.maps.map(mapInfo)}});
  const r=await GET(request(`id=${edition.edition_id}&map=${bundle.maps[0].id}`));
  expect(r.headers.get("cache-control")).toBe("no-store");expect((await r.json()).publication_state).toBe("preview");
});
it("does not borrow maps for an older edition or after integrity/read failure",async()=>{
  vi.mocked(editionMaps).mockResolvedValue({view:{status:"absent",code:"MAP_NOT_PUBLISHED",maps:[]}});
  const old=editions.find(e=>e.date<edition.date)!;
  expect((await GET(request(`id=${old.edition_id}&map=${bundle.maps[0].id}`))).status).toBe(404);
  expect(vi.mocked(editionMaps).mock.calls[0][0].edition_id).toBe(old.edition_id);
  vi.mocked(editionMaps).mockResolvedValue({view:{status:"error",code:"MAP_ARCHIVE_UNAVAILABLE_OR_INVALID",maps:[]}});
  expect((await GET(request(`id=${edition.edition_id}&map=${bundle.maps[0].id}`))).status).toBe(503);
});
it("rejects unknown/path traversal IDs before a storage read",async()=>{
  expect((await GET(request("id=../../secret"))).status).toBe(400);
  expect((await GET(request(`id=${"0".repeat(64)}`))).status).toBe(404);
  expect(editionMaps).not.toHaveBeenCalled();
});
