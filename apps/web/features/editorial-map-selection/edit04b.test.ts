import {expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {readNovember15} from "../../../../scripts/edit04b_archives";
import {readEdit04Archive} from "../../../../scripts/edit04_archives";
import {allBlocks,type EditorialDraft} from "../editorial-ai/model";
import {validateDraft} from "../editorial-ai/validate";
import {chooseDaily,dailyRequest,mapsDigest,selectedMapIds} from "./daily";
import {validateCommittee} from "./committee";
import {buildCatalogue} from "./catalogue";
import {rankCatalogue} from "./rank";
import {hash} from "../editorial/temporal";
import {journalMapCards} from "../edition-maps/carousel-model";
import {mapInfo} from "../edition-maps/model";
const source=readNovember15();
it("revalidates the exact rejected text of November 15 without rewriting it",()=>{
 const {rejected}=source,before=hash(rejected);
 expect(rejected.validation.errors).toEqual(["REGIONAL_EXTRAPOLATION","TEXT_NUMBER_OR_DATE"]);
 expect(validateDraft(rejected.draft,rejected.briefing).errors).toEqual([]);
 expect(validateDraft(rejected.draft,rejected.briefing).status).toBe("needs_editorial_review");
 expect(hash(rejected)).toBe(before);
});
it("still rejects changed signs, figures, dates and affirmative regional extrapolation",()=>{
 for(const [from,to,error] of [["−0,8","0,8","TEXT_NUMBER_OR_DATE"],["47,8","48,0","TEXT_NUMBER_OR_DATE"],["15 au 21 novembre","15 au 22 novembre","TEXT_NUMBER_OR_DATE"],["pas d’une moyenne régionale","une moyenne régionale","REGIONAL_EXTRAPOLATION"]]){
  const draft=structuredClone(source.rejected.draft);
  for(const block of allBlocks(draft))block.text=block.text.replace(from,to);
  expect(validateDraft(draft,source.rejected.briefing).errors).toContain(error);
 }
});
it("keeps the incomplete actual provider selection inadmissible; a complete shorter choice is valid",()=>{
 const s=source.rejected.map_selection!,raw=(source.response.draft as {draft:EditorialDraft;map_selection:typeof s.response}).map_selection;
 expect(raw.priority).toHaveLength(1);expect(raw.excluded).toHaveLength(5);
 expect(()=>validateCommittee(raw,s.ranking,true)).toThrow("EDIT03_BOARD_SELECTION");
 expect(chooseDaily(s.ranking,s.maps_sha256,raw).mode).toBe("deterministic");
 const repaired=structuredClone(raw),seen=new Set([...raw.priority,...raw.excluded].map(c=>c.map_id));
 for(const row of s.ranking.ranked.filter(r=>r.card.admission.eligible&&!seen.has(r.card.id)))
  repaired.excluded.push({map_id:row.card.id,reason_ids:[row.reasons[0].id],seasonal_ids:[]});
 const selected=chooseDaily(s.ranking,s.maps_sha256,repaired);
 expect(selected.mode).toBe("ai");expect(selected.response.complementary).toEqual([]);
 const req=dailyRequest(s.ranking),schema=req.response_schema.properties.priority.items;
 expect(req.instructions).toContain("exactement une fois");
 expect(schema.properties.reason_ids.items.enum).toContain(raw.priority[0].reason_ids[0]);
 expect(schema.properties.reason_ids.items.enum).not.toContain(`${raw.priority[0].map_id}:excluded`);
});
for(const archived of [readEdit04Archive("2026-11-13"),readEdit04Archive("2026-11-14"),source])it(`replays ${archived.archive.date} without publication and binds every carousel card`,()=>{
 const before=hash(archived),{archive,bundle}=archived;
 expect(validateDraft(archive.draft,archive.briefing).errors).toEqual([]);
 const selected=chooseDaily(rankCatalogue(buildCatalogue(archive,bundle),{min_score:45,max_cards:6}),mapsDigest(bundle));
 const ids=selectedMapIds(selected,bundle);
 const view={status:"published" as const,code:"MAP_PUBLISHED",maps:bundle.maps.map(mapInfo)};
 expect(journalMapCards(view,archive.edition_id,archive.date).map(c=>c.map_id)).toEqual(bundle.maps.map(m=>m.id));
 const cards=journalMapCards(view,archive.edition_id,archive.date,{hero_map_id:selected.response.hero_map_id,map_ids:ids});
 expect(cards.map(c=>c.map_id)).toEqual(ids);expect(cards[0].role).toBe("hero");
 for(const c of cards){
  const link=new URL(c.interactive_url,"https://local.invalid"),thumb=new URL(c.thumbnail_url,"https://local.invalid");
  expect(link.searchParams.get("id")).toBe(archive.edition_id);expect(link.searchParams.get("date")).toBe(archive.date);
  expect(link.searchParams.get("map")).toBe(c.map_id);expect(thumb.searchParams.get("map")).toBe(c.map_id);expect(thumb.searchParams.get("id")).toBe(archive.edition_id);
  expect(c.info).toEqual(mapInfo(bundle.maps.find(m=>m.id===c.map_id)!));
 }
 expect(hash(archived)).toBe(before);
});
