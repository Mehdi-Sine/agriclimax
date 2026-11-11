import {describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {assessHistory,qualityLimitations} from "./data-quality";
import {freezeSnapshot,verifySnapshot,type Cycle} from "./snapshot";
import {buildBriefing} from "../editorial/briefing";
import {assertBriefing} from "../editorial/validate";
import {reconstructEpisodes,hash,shift,type DailyEvidence} from "../editorial/temporal";
import {validateDraft} from "../editorial-ai/validate";
import simulated from "../../../../docs/codex/task35/evidence/simulated-edition.json";
import type {EditorialDraft} from "../editorial-ai/model";
const date="2026-11-11",now="2026-11-11T08:00:00Z";
function history(reference="2026-11-10",count=713):DailyEvidence[] {
 return Array.from({length:count},(_,i)=>["heat","frost","dry","rain"].flatMap(phenomenon=>[0,1,2].map(offset=>({
  date:shift(reference,offset-2),pra:`pra:${i}`,region:"Bretagne",phenomenon,value:phenomenon==="dry"?0:10,
  detected:phenomenon==="dry",signature:`${i}/${phenomenon}`,rule_version:"synthetic-only",unit:phenomenon==="dry"?"jours":"°C",
  nature:"reanalysis" as const,provenance:["synthetic"],data_freshness:[now],quality_flags:[],
 })))).flat();
}
function dossier(rows=history()) {
 const cutoff=rows.map(r=>r.date).sort().at(-1)!;
 return buildBriefing({date,generated_at:now,history_cutoff:cutoff,source_fingerprint:hash(rows),history:rows,
  comparisons:[],episodes:reconstructEpisodes(rows,cutoff),episode_archive_sha256:hash("synthetic")});
}
const cycle:Cycle={provider:"ecmwf",model:"ifs",emitted_at:"2026-11-11T00:00:00Z",acquired_at:"2026-11-11T01:00:00Z",valid_dates:[date,shift(date,1)],variables:["temperature_min","temperature_max","precipitation"],pra_count:713,quality:"qualified",continuity:true,archive:{path:"weather/synthetic",sha256:"a".repeat(64)},source_version:"pra-national-weather-daily-1",support_qualification:["CORE-01"]};
describe("OPS-03 independent weather sources and recovery",()=>{
 it("admits a normal complete dossier without using acquisition success as coverage",()=>{
  expect(freezeSnapshot(date,[cycle],dossier(),now,assessHistory(history(),date)).quality).toBe("fresh");
 });
 it("admits a retrospective dossier after forecast and stations failure",()=>{
  const rows=history(),q=assessHistory(rows,date),b=dossier(rows);
  b.limitations.push(...qualityLimitations(q,false,[{source:"stations",state:"retryable_failure"},{source:"forecast",state:"retryable_failure"}]));b.bundle_id=hash({...b,bundle_id:undefined});
  assertBriefing(b);expect(b.candidates.every(c=>c.nature==="reanalysis")).toBe(true);
  const snapshot=freezeSnapshot(date,[],b,now,q);expect(snapshot.quality).toBe("fallback_valid");expect(snapshot.sources).toEqual([]);verifySnapshot(snapshot);
 });
 it("dates J-7 reanalysis as historical, never as yesterday's observation",()=>{
  const rows=history("2026-11-04"),q=assessHistory(rows,date),b=dossier(rows);
  expect(q).toMatchObject({usable:true,age_days:7,freshness:"historical",reference_date:"2026-11-04"});
  expect(b.validity.history_age_days).toBe(7);expect(b.validity.data_freshness).toBe("stale");
  expect(b.national.facts.every(f=>f.period[1]==="2026-11-04"&&f.source==="era5-land")).toBe(true);
 });
 it("refuses old or insufficient national support and retains the previous edition",()=>{
  for(const rows of [history("2026-10-20"),history("2026-11-10",570)]) {
   const q=assessHistory(rows,date);expect(q.usable).toBe(false);
   expect(freezeSnapshot(date,[],dossier(rows),now,q).quality).toBe("insufficient");
  }
 });
 it("does not count a PRA with a missing native descriptor as complete",()=>{
  const rows=history();rows.find(r=>r.pra==="pra:0"&&r.phenomenon==="frost"&&r.date==="2026-11-10")!.value=null;
  expect(assessHistory(rows,date).complete_pra).toBe(712);
 });
 it("allows past-date recovery with the original source cutoff and stable input identity",()=>{
  const b=dossier(),q=assessHistory(history(),date);
  const a=freezeSnapshot(date,[],b,"2026-11-12T09:00:00Z",q);
  expect(a.cutoff_at).toBe("2026-11-11T04:40:00.000Z");verifySnapshot(a);
  expect(freezeSnapshot(date,[],b,"2026-11-12T09:00:00Z",q).id).toBe(a.id);
 });
 it("rejects a factual forecast invented in a retrospective dossier",()=>{
  const b=dossier();const d=structuredClone(simulated.draft) as EditorialDraft;
  d.bundle_id=b.bundle_id;d.edition_date=date;
  d.headline={text:"Des pluies sont prévues demain",kind:"fact",evidence_ids:[b.national.facts[0].id],seasonal_ids:[]};
  expect(validateDraft(d,b).errors).toContain("FORECAST_WITHOUT_EVIDENCE");
 });
 it("projects real-shaped T34 metadata to the strict T33 contract",()=>{
  const rows=history(),b=dossier(rows);
  const pub={id:"news",source_id:"draaf",publisher:"DRAAF",title:"Contexte",original_url:"https://example.org/news",published_at:"2026-11-10T00:00:00Z",content_type:"news",limitations:[],summary:"extra T34 field",revision:"extra"};
  const rebuilt=buildBriefing({date,generated_at:now,history_cutoff:"2026-11-10",source_fingerprint:hash(rows),history:rows,comparisons:[],episodes:reconstructEpisodes(rows,"2026-11-10"),episode_archive_sha256:hash("synthetic"),news:{bundle_id:"news",generated_at:now,publications:[pub],links:[{publication_id:"news",event_id:"synthetic",relation:"documentary-candidate",axes:{temporal:"unknown",geographic:"unknown",production:"unknown",phenomenon:"unknown",thematic:"unknown"},temporal_distance_days:0,scientific_confirmation:false,limitation:"documentary only"}]}});
  expect(b.national.facts.length).toBeGreaterThan(0);expect(rebuilt.documentary.publications).toHaveLength(1);
  expect(rebuilt.documentary.publications[0]).not.toHaveProperty("summary");assertBriefing(rebuilt);
 });
});
