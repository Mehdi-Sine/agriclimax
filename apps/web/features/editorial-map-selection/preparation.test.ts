import {it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("../../../../scripts/edit04_frozen",()=>({readFrozenMapInputs:vi.fn()}));
vi.mock("../../../../scripts/int01_map_builder",()=>({buildEditionMaps:vi.fn()}));
import {readFrozenMapInputs} from "../../../../scripts/edit04_frozen";
import {buildEditionMaps} from "../../../../scripts/int01_map_builder";
import {prepareDailySelection} from "../../../../scripts/edit04_selection";
import {readEdit04Archive,DATES} from "../../../../scripts/edit04_archives";
import {verifyArchive} from "../editorial-ai/archive";
import {sealBundle} from "../edition-maps/model";
import {selectedMapIds} from "./daily";
import type {DailyEditorialSnapshot} from "../nightly/snapshot";
for(const date of DATES)it(`prepares a contract-valid candidate before the editorial call for ${date}`,async()=>{
 const source=readEdit04Archive(date),id="c".repeat(64);
 // Only the boundary inputs are synthetic; scientific computation is separately replayed against frozen snapshots.
 const snapshot={briefing:source.archive.briefing,frozen_at:source.archive.generated_at} as DailyEditorialSnapshot;
 vi.mocked(readFrozenMapInputs).mockResolvedValue({inputs:{history:[],document:null},bytes:Buffer.alloc(0)});
 vi.mocked(buildEditionMaps).mockImplementation((seed,passed)=>{
  verifyArchive(seed);expect(seed.edition_id).toBe(id);expect(passed).toBe(snapshot);
  const {sha256,...bundle}=source.bundle;void sha256;
  return sealBundle({...bundle,edition_id:id,edition_checksum:seed.checksum});
 });
 const result=await prepareDailySelection(snapshot,id);
 expect(result.ranking.edition_id).toBe(id);expect(selectedMapIds(result,source.bundle)).toHaveLength(6);
});
