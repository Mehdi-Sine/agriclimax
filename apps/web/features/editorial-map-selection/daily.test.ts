import {it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {DATES,readEdit04Archive} from "../../../../scripts/edit04_archives";
import {buildCatalogue} from "./catalogue";
import {rankCatalogue} from "./rank";
import {chooseDaily,dailyRequest,mapsDigest,selectedMapIds,verifyDailySelection,type DailySelection} from "./daily";
import {mapInfo,sealMap,sealBundle} from "../edition-maps/model";
import {journalMapCards} from "../edition-maps/carousel-model";
import {hash} from "../editorial/temporal";
import {sealArchive,verifyArchive,type Run} from "../editorial-ai/archive";
import type {Archive} from "../editorial-ai/model";
import {generateOperational,operationalConfig,type AttemptStore} from "../editorial-ai/generate-operational";
import {fallbackDraft} from "../editorial-ai/fallback";
import {ProviderFailure,requestBody} from "../editorial-ai/provider";
import {editorialPayload} from "../editorial-ai/budget";
import {auditSchema} from "../editorial-ai/request-audit";
import {consultableEdition} from "../editorial-ai/consultable";
const sources=DATES.map(readEdit04Archive);
for(const source of sources)it(`preserves ${source.archive.date} archive and exact map/thumbnail/link identities`,()=>{
 const before=hash(source),{archive,bundle}=source;
 const ranking=rankCatalogue(buildCatalogue(archive,bundle),{min_score:45,max_cards:6});
 const selection=chooseDaily(ranking,mapsDigest(bundle));verifyDailySelection(selection);
 const ids=selectedMapIds(selection,bundle);
 expect(ids.length).toBeGreaterThan(0);expect(ids.length).toBeLessThanOrEqual(6);expect(ids[0]).toBe(selection.response.hero_map_id);
 const view={status:"published" as const,code:"MAP_PUBLISHED",maps:bundle.maps.map(mapInfo)};
 expect(journalMapCards(view,archive.edition_id,archive.date).map(c=>c.map_id)).toEqual(bundle.maps.map(m=>m.id));
 const cards=journalMapCards(view,archive.edition_id,archive.date,{hero_map_id:ids[0],map_ids:ids});
 for(const card of cards){
  const url=new URL(card.interactive_url,"https://local.invalid"),thumb=new URL(card.thumbnail_url,"https://local.invalid");
  expect(thumb.searchParams.get("id")).toBe(url.searchParams.get("id"));expect(thumb.searchParams.get("map")).toBe(card.map_id);expect(url.searchParams.get("map")).toBe(card.map_id);
  expect(card.info).toEqual(mapInfo(bundle.maps.find(m=>m.id===card.map_id)!));
 }
 expect(hash(source)).toBe(before);
 const body=requestBody(editorialPayload(archive.briefing,[],dailyRequest(ranking)),operationalConfig("gpt-6.1-terra"));
 expect(auditSchema(body.text.format.schema).max_depth).toBeLessThanOrEqual(10);expect(body.max_output_tokens).toBe(6000);
 const altered=structuredClone(bundle);altered.maps[0].rows[0].value=999;
 expect(()=>selectedMapIds(selection,altered)).toThrow("EDIT04_MAP_BINDING");
});
function forAttempt(id:string):DailySelection {
 const source=sources[2],{checksum,...body}=source.archive;void checksum;
 const archive=sealArchive({...body,edition_id:id});
 const {sha256,...bundle}=source.bundle;void sha256;
 const rebound=sealBundle({...bundle,edition_id:id,edition_checksum:archive.checksum});
 return chooseDaily(rankCatalogue(buildCatalogue(archive,rebound),{min_score:45,max_cards:6}),mapsDigest(rebound));
}
function store(){
 let run:Run|undefined;const archives=new Map<string,Archive>(),diagnostics:unknown[]=[];
 const api:AttemptStore={claimAttempt:async r=>{if(run?.archive_id)return run;run={...r};return r;},finishAttempt:async r=>{if(run?.state!=="running")throw Error("INVALID_ATTEMPT_TRANSITION");run={...r};},save:async a=>{verifyArchive(a);if(a.mode==="fallback"&&a.supersedes===null)expect(a.edition_id).toBe(run?.id);archives.set(a.edition_id,a);},read:async id=>archives.get(id)??null,diagnostic:async(_,v)=>{diagnostics.push(v);}};
 return {api,archives,diagnostics};
}
for(const kind of ["valid","short","invented","evidence","duplicate","missing","throw","malformed","science","model"] as const)it(`single-call ${kind}, idempotent factual/deterministic recovery`,async()=>{
 const s=store(),b=sources[2].archive.briefing,c=operationalConfig("gpt-6.1-terra");let prepared:DailySelection;
 const provider=vi.fn(async(payload:string)=>{
  expect(JSON.parse(payload).map_selection.cards).toHaveLength(10);
  if(kind==="throw")throw new ProviderFailure("PROVIDER_TIMEOUT_OR_TRANSPORT");
  const response=structuredClone(prepared.response);
  if(kind==="short"){response.excluded.push(...response.complementary);response.complementary=[];}
  if(kind==="invented")response.priority[0].map_id="invented";
  if(kind==="evidence")response.priority[0].reason_ids=["invented"];
  if(kind==="duplicate")response.complementary.push(response.priority[0]);
  if(kind==="missing")response.excluded=[];
  let draft:unknown=fallbackDraft(b);
  if(kind==="malformed")draft={};
  if(kind==="science")draft={...fallbackDraft(b),headline:{text:"Le gel détruit toutes les récoltes",kind:"fact",evidence_ids:[],seasonal_ids:[]}};
  return {draft:{draft,map_selection:response},model:kind==="model"?"unqualified-model":c.model,response_id:"synthetic-only",usage:{input_tokens:100,output_tokens:100,reasoning_tokens:0}};
 });
 const options={briefing:b,config:c,store:s.api,provider,manualRetry:false,prepareSelection:async(id:string)=>{prepared=forAttempt(id);return prepared;}};
 const a=await generateOperational(options);
 expect(provider).toHaveBeenCalledTimes(1);expect(a.validation.status).not.toBe("rejected");
 expect(a.map_selection?.mode).toBe(kind==="valid"||kind==="short"?"ai":"deterministic");
 if(kind==="short")expect(a.map_selection?.response.complementary).toHaveLength(0);
 if(["throw","malformed","science","model"].includes(kind))expect(a.mode).toBe("fallback");
 expect(consultableEdition(a).map_selection?.map_ids[0]).toBe(a.map_selection?.response.hero_map_id);
 expect((await generateOperational(options)).checksum).toBe(a.checksum);expect(provider).toHaveBeenCalledTimes(1);
 expect(s.diagnostics.length).toBeGreaterThan(0);
});
it("rejects a corrupt ranking and unknown thumbnail reference",()=>{
 const s=forAttempt("a".repeat(64)),bad=structuredClone(s);bad.ranking.ranked[0].score=100;
 expect(()=>verifyDailySelection(bad)).toThrow("EDIT04_RANKING_INTEGRITY");
 expect(journalMapCards({status:"published",code:"",maps:sources[2].bundle.maps.map(mapInfo)},"a".repeat(64),"2026-11-14",{hero_map_id:"invented",map_ids:["invented"]})).toEqual([]);
});
it("accepts a different AI hero and never fills a short edition",()=>{
 const s=forAttempt("b".repeat(64)),response=structuredClone(s.response);
 const original=response.priority[0],newHero=response.complementary.shift()!;
 response.hero_map_id=newHero.map_id;response.priority=[newHero];response.excluded.push(original,...response.complementary);response.complementary=[];
 const selected=chooseDaily(s.ranking,s.maps_sha256,response);verifyDailySelection(selected);
 expect(selected.mode).toBe("ai");expect(selected.response.hero_map_id).toBe(newHero.map_id);expect(selected.response.complementary).toEqual([]);
 expect(JSON.stringify(dailyRequest(s.ranking))).not.toContain("qualified_values");
});
it("admits no map when all territorial values are excluded by Journal qualification",()=>{
 const source=sources[2],bundle=structuredClone(source.bundle);
 // Synthetic qualification only. No scientific value changed or exported.
 for(const m of bundle.maps)for(const row of m.rows)row.quality!.journal_eligible=false;
 const {sha256,...body}=bundle;void sha256;
 body.maps=body.maps.map(({id,...m})=>{void id;return sealMap(m);});
 const rebound=sealBundle(body),ranking=rankCatalogue(buildCatalogue(source.archive,rebound),{min_score:45,max_cards:6});
 const s=chooseDaily(ranking,mapsDigest(rebound));verifyDailySelection(s);
 expect(selectedMapIds(s,rebound)).toEqual([]);expect(s.response.hero_map_id).toBeNull();
});
