import {describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import example from "../../../../docs/codex/task33/evidence/briefing-example.json";
import simulated from "../../../../docs/codex/task35/evidence/simulated-edition.json";
import type {EditorialBriefingBundle} from "../editorial/briefing";
import type {Archive} from "../editorial-ai/model";
import type {Run} from "../editorial-ai/archive";
import {verifyArchive} from "../editorial-ai/archive";
import {generateOperational,operationalConfig,type AttemptStore} from "../editorial-ai/generate-operational";
import {ProviderFailure} from "../editorial-ai/provider";
const briefing=example as unknown as EditorialBriefingBundle;
function store() {
 const archives=new Map<string,Archive>(),runs:Run[]=[];
 const api:AttemptStore={claimAttempt:vi.fn(async(r)=>{const completed=runs.find(v=>v.state==="completed");if(completed)return {...completed};runs.push({...r});return r;}),finishAttempt:vi.fn(async(r)=>{runs[runs.findIndex(v=>v.id===r.id)]={...r};}),diagnostic:vi.fn(async()=>{}),save:vi.fn(async(a)=>{verifyArchive(a);archives.set(a.edition_id,a);}),read:async(id)=>archives.get(id)??null};
 return {api,runs,archives};
}
describe("project-managed OpenAI spending and operational attempts",()=>{
 it("accepts a real-shaped response with missing usage, without a financial reservation",async()=>{
  const s=store(),c={...operationalConfig("gpt-6.1-terra"),monthly_budget_eur:0,max_edition_eur:0};
  const provider=vi.fn().mockResolvedValue({draft:simulated.draft,model:c.model,response_id:"resp_synthetic",usage:null});
  const a=await generateOperational({briefing,config:c,store:s.api,provider,manualRetry:true});
  expect(a.mode).toBe("live");expect(a.receipt?.usage).toBeNull();expect(a.receipt?.cost_eur).toBeNull();expect(s.runs[0].reserved_eur).toBe(0);expect(s.runs[0].state).toBe("completed");
  await generateOperational({briefing,config:c,store:s.api,provider,manualRetry:true});expect(provider).toHaveBeenCalledTimes(1);
 });
 it("keeps separate attempts on the same real date after a failure, without automatic retries or fallback articles",async()=>{
  const s=store(),config=operationalConfig("gpt-6.1-terra"),provider=vi.fn().mockRejectedValue(new ProviderFailure("PROVIDER_HTTP_400"));
  for(let i=0;i<2;i++) await expect(generateOperational({briefing,config,store:s.api,provider,manualRetry:true})).rejects.toThrow("PROVIDER_HTTP_400");
  expect(provider).toHaveBeenCalledTimes(2);expect(s.runs[0].id).not.toBe(s.runs[1].id);expect(s.runs.every(r=>r.edition_date===briefing.edition_date&&r.state==="outcome_unknown")).toBe(true);expect(s.archives.size).toBe(0);
 });
 it("retains rejected output and publishes a separately checked factual replacement with one call",async()=>{
  const s=store(),config=operationalConfig("gpt-6.1-terra"),provider=vi.fn().mockResolvedValue({draft:{...simulated.draft,bundle_id:"invented"},model:config.model,response_id:"resp_synthetic",usage:{input_tokens:1,output_tokens:1,reasoning_tokens:0}});
  const fallback=await generateOperational({briefing,config,store:s.api,provider,manualRetry:true});
  expect(s.archives.size).toBe(2);expect([...s.archives.values()][0].validation.status).toBe("rejected");
  expect(fallback.mode).toBe("fallback");expect(fallback.receipt).toBeNull();expect(fallback.validation.errors).toEqual([]);
  expect(fallback.supersedes).toBe([...s.archives.keys()][0]);expect(s.runs[0].archive_id).toBe(fallback.edition_id);
  expect(s.runs[0].state).toBe("completed");expect(s.api.diagnostic).toHaveBeenCalled();
  const {consultableEdition}=await import("../editorial-ai/consultable");expect(consultableEdition(fallback).consultable).toBe(true);
  await generateOperational({briefing,config,store:s.api,provider,manualRetry:false});expect(provider).toHaveBeenCalledTimes(1);
 });
});

describe("OPS-02 response recovery",()=>{
 it("reuses the exact validation/archive engine without a provider request",async()=>{
  const {archiveOperationalResult}=await import("../editorial-ai/generate-operational");
  const s=store(),config=operationalConfig("gpt-6.1-terra");
  const run:Run={id:"a".repeat(64),edition_date:briefing.edition_date,scope:"daily",month:"2026-11",state:"outcome_unknown",reserved_eur:0,actual_eur:null,error:"INTERRUPTED",archive_id:null};
  const a=await archiveOperationalResult({briefing,config,store:s.api,run,
   result:{draft:simulated.draft,model:config.model,response_id:"resp_persisted",usage:null},generatedAt:"2026-11-10T05:05:00Z",durationMs:0});
  expect(a.edition_id).toBe(run.id);expect(a.receipt?.response_id).toBe("resp_persisted");
  expect(s.api.claimAttempt).not.toHaveBeenCalled();expect(s.api.finishAttempt).not.toHaveBeenCalled();
  verifyArchive(a);expect(s.archives.size).toBe(1);
 });
 it("keeps malformed archived responses unpublishable",async()=>{
  const {archiveOperationalResult}=await import("../editorial-ai/generate-operational");
  const s=store(),config=operationalConfig("gpt-6.1-terra");
  const run:Run={id:"a".repeat(64),edition_date:briefing.edition_date,scope:"daily",month:"2026-11",state:"outcome_unknown",reserved_eur:0,actual_eur:null,error:null,archive_id:null};
  await expect(archiveOperationalResult({briefing,config,store:s.api,run,
   result:{draft:{},model:config.model,response_id:"resp_persisted",usage:null},generatedAt:"2026-11-10T05:05:00Z",durationMs:0})).rejects.toThrow();
  expect(s.archives.size).toBe(0);
 });
});
