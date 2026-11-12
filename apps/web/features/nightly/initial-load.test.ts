import {beforeEach,describe,expect,it,vi} from "vitest";
import type {Archive} from "../editorial-ai/model";
vi.mock("server-only",()=>({}));
const state=vi.hoisted(()=>({read:vi.fn(),runs:vi.fn()}));
vi.mock("../editorial-ai/supabase-store",()=>({
 editorialRPC:state.runs,
 SupabaseEditorialStore:class {read(id:string){return state.read(id) as Promise<Archive|null>;}},
}));
vi.mock("../../lib/server/edition-maps",()=>({mapPreviewEdition:()=>null,readPublishedMaps:vi.fn()}));
import {readPublishedMaps} from "../../lib/server/edition-maps";
import {sealArchive} from "../editorial-ai/archive";
import simulated from "../../../../docs/codex/task35/evidence/simulated-edition.json";
import {PROMPT_VERSION} from "../editorial-ai/model";
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();});
describe("initial Journal archive loading",()=>{
 it("bounds parallel reads, deduplicates archive IDs and shares concurrent requests",async()=>{
  const releases:(()=>void)[]=[];let active=0,peak=0;
  state.runs.mockResolvedValue([...Array.from({length:9},(_,i)=>({state:"completed",archive_id:`archive-${i}`})),{state:"completed",archive_id:"archive-0"}]);
  state.read.mockImplementation(()=>new Promise(resolve=>{active++;peak=Math.max(peak,active);releases.push(()=>{active--;resolve(null);});}));
  const {operationalEditions}=await import("../../lib/server/editorial-published");
  const first=operationalEditions(),second=operationalEditions();
  expect(first).toBe(second);await flush();
  expect(active).toBe(6);expect(state.runs).toHaveBeenCalledTimes(1);
  while(releases.length){releases.shift()!();await flush();}
  await first;expect(peak).toBe(6);expect(state.read).toHaveBeenCalledTimes(9);
  expect(new Set(state.read.mock.calls.map(c=>c[0])).size).toBe(9);
 });
 it("retries after an outage and still withholds text until its immutable map commit",async()=>{
  const {checksum,...body}=simulated as unknown as Archive;void checksum;
  const archive=sealArchive({...body,prompt_version:PROMPT_VERSION,mode:"live",receipt:{model:body.parameters.model,response_id:"synthetic",usage:null,cost_eur:null,duration_ms:0,pricing_version:"synthetic"}});
  state.runs.mockRejectedValueOnce(Error("OUTAGE")).mockResolvedValue([{state:"completed",archive_id:archive.edition_id}]);
  state.read.mockResolvedValue(archive);
  const {operationalEditions}=await import("../../lib/server/editorial-published");
  const contains=async()=> (await operationalEditions()).some(e=>e.edition_id===archive.edition_id);
  expect(await contains()).toBe(false);
  vi.mocked(readPublishedMaps).mockResolvedValue(null);expect(await contains()).toBe(false);
  vi.mocked(readPublishedMaps).mockRejectedValue(Error("MAP_BLOB_INTEGRITY"));expect(await contains()).toBe(false);
  vi.mocked(readPublishedMaps).mockResolvedValue({} as never);expect(await contains()).toBe(true);
  expect(state.runs).toHaveBeenCalledTimes(4);
 });
});
