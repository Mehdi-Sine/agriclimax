import {describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
const state=vi.hoisted(()=>({archive:null as unknown}));
vi.mock("../editorial-ai/supabase-store",()=>({
 editorialRPC:vi.fn(async()=>[{archive_id:"synthetic",state:"completed"}]),
 SupabaseEditorialStore:class {async read(){return state.archive;}},
}));
vi.mock("../../lib/server/edition-maps",()=>({mapPreviewEdition:()=>null,readPublishedMaps:vi.fn()}));
import {readPublishedMaps} from "../../lib/server/edition-maps";
import {sealArchive} from "../editorial-ai/archive";
import {PROMPT_VERSION,type Archive} from "../editorial-ai/model";
import simulated from "../../../../docs/codex/task35/evidence/simulated-edition.json";
describe("experimental publication commit",()=>{
 it("withholds a new text on absent or corrupt maps, then exposes it after the verified map commit",async()=>{
  const {checksum,...body}=simulated as unknown as Archive;void checksum;
  const a=sealArchive({...body,prompt_version:PROMPT_VERSION,mode:"live",receipt:{model:body.parameters.model,response_id:"synthetic",usage:null,cost_eur:null,duration_ms:0,pricing_version:"synthetic"}});
  state.archive=a;
  vi.resetModules();const {operationalEditions}=await import("../../lib/server/editorial-published");
  vi.mocked(readPublishedMaps).mockResolvedValue(null);
  expect((await operationalEditions()).some(e=>e.edition_id===a.edition_id)).toBe(false);
  vi.mocked(readPublishedMaps).mockRejectedValue(Error("MAP_BLOB_INTEGRITY"));
  expect((await operationalEditions()).some(e=>e.edition_id===a.edition_id)).toBe(false);
  // Map verification is tested independently; this test exercises the publication boundary.
  vi.mocked(readPublishedMaps).mockResolvedValue({} as never);
  expect((await operationalEditions()).some(e=>e.edition_id===a.edition_id)).toBe(true);
 });
});
