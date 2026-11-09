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
 it("archives rejected scientific output for owner inspection without admitting it for publication",async()=>{
  const s=store(),config=operationalConfig("gpt-6.1-terra"),provider=vi.fn().mockResolvedValue({draft:{...simulated.draft,bundle_id:"invented"},model:config.model,response_id:"resp_synthetic",usage:{input_tokens:1,output_tokens:1,reasoning_tokens:0}});
  await expect(generateOperational({briefing,config,store:s.api,provider,manualRetry:true})).rejects.toThrow("DRAFT_REJECTED");
  expect(s.archives.size).toBe(1);expect([...s.archives.values()][0].validation.status).toBe("rejected");expect(s.runs[0].state).toBe("validation_failed");expect(s.api.diagnostic).toHaveBeenCalled();
 });
});
