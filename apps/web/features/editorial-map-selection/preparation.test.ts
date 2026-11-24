import {it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("../../../../scripts/edit04_frozen",()=>({readFrozenMapInputs:vi.fn()}));
vi.mock("../../../../scripts/int01_map_builder",()=>({buildEditionMaps:vi.fn()}));
import {readFrozenMapInputs} from "../../../../scripts/edit04_frozen";
import {buildEditionMaps} from "../../../../scripts/int01_map_builder";
import {prepareDailySelection} from "../../../../scripts/edit04_selection";
import {readEdit04Archive,DATES} from "../../../../scripts/edit04_archives";
import type {EditorialBriefingBundle} from "../editorial/briefing";
import type {Archive} from "../editorial-ai/model";
import {hash,shift} from "../editorial/temporal";
import {archiveProviderFactualFallback,operationalConfig} from "../editorial-ai/generate-operational";
import {verifyArchive} from "../editorial-ai/archive";
import {sealBundle,sealMap} from "../edition-maps/model";
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

it("archives the factual fallback with frozen field summaries and only eligible maps",async()=>{
 const source=readEdit04Archive(DATES[2]),id="d".repeat(64);
 const end=source.archive.briefing.validity.history_cutoff;
 const body:Omit<EditorialBriefingBundle,"bundle_id">={...source.archive.briefing,agro_field:[{
  version:"agro-field-summary-1",indicator:"field_antecedent_rain",rule_version:"agro-field-1.0.0",
  label:"Pluie antécédente",unit:"mm",period:{start:shift(end,-6),end,timezone:"UTC"},
  source:{label:"ERA5-Land",version:"fixture"},data_freshness:[end],provenance:["fixture"],
  quality_flags:[],total_pra:713,evaluable_pra:700,limitations:[],maximum:12,maximum_count:1,territories:[],
 }]};
 const briefing={...body,bundle_id:hash({...body,bundle_id:undefined})};
 const snapshot={briefing,frozen_at:source.archive.generated_at} as DailyEditorialSnapshot;
 vi.mocked(readFrozenMapInputs).mockResolvedValue({inputs:{history:[],document:null},bytes:Buffer.alloc(0)});
 vi.mocked(buildEditionMaps).mockImplementation(seed=>{
  const {sha256,...bundle}=source.bundle;void sha256;
  const [first,...otherMaps]=bundle.maps;
  const {id:previousId,...card}=first;void previousId;
  const excluded=sealMap({...card,rows:card.rows.map(r=>r.quality
    ? {...r,quality:{...r.quality,journal_eligible:false}} : r)});
  return sealBundle({...bundle,edition_id:id,edition_checksum:seed.checksum,maps:[excluded,...otherMaps]});
 });
 const selection=await prepareDailySelection(snapshot,id);
 const excluded=selection.ranking.ranked.find(r=>!r.card.admission.eligible);
 expect(excluded).toBeDefined();
 expect(selection.response.hero_map_id).not.toBeNull();
 expect(selection.ranking.selected_ids).not.toContain(excluded?.card.id);
 const save=vi.fn(async (archive:Archive)=>verifyArchive(archive));
 const archive=await archiveProviderFactualFallback({briefing,config:operationalConfig("gpt-6.1-terra"),runId:id,
  generatedAt:snapshot.frozen_at,mapSelection:selection,store:{save,claimAttempt:vi.fn(),finishAttempt:vi.fn(),
   diagnostic:vi.fn(),read:vi.fn()}});
 expect(save).toHaveBeenCalledOnce();
 expect(archive.receipt).toBeNull();
 expect(archive.briefing.agro_field).toEqual(briefing.agro_field);
 expect(archive.map_selection?.response.hero_map_id).toBe(selection.response.hero_map_id);
});
