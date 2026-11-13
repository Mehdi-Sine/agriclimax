import {describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import replay from "../../../../fixtures/editorial/ops07-20261113.json";
import {generateOperational,archiveFactualFallback,operationalConfig,type AttemptStore} from "../editorial-ai/generate-operational";
import {verifyArchive} from "../editorial-ai/archive";
import {validateDraft} from "../editorial-ai/validate";
import {consultableEdition} from "../editorial-ai/consultable";
import type {EditorialBriefingBundle} from "../editorial/briefing";
import type {Archive} from "../editorial-ai/model";
import type {Run} from "../editorial-ai/archive";

describe("OPS-07 real November 13 response replay",()=>{
 it("retains REGIONAL_EXTRAPOLATION and produces an idempotent factual revision with no second provider call",async()=>{
  const briefing=replay.briefing as unknown as EditorialBriefingBundle;
  const before=JSON.stringify(replay),archives=new Map<string,Archive>();
  let run:Run|undefined;
  const store:AttemptStore={
   claimAttempt:vi.fn(async r=>{run=r;return r;}),finishAttempt:vi.fn(async r=>{run=r;}),diagnostic:vi.fn(async()=>{}),
   save:vi.fn(async a=>{verifyArchive(a);const old=archives.get(a.edition_id);if(old&&old.checksum!==a.checksum)throw Error("IMMUTABLE_ARCHIVE_CONFLICT");archives.set(a.edition_id,a);}),
   read:async id=>archives.get(id)??null,
  };
  const config=operationalConfig("gpt-6.1-terra");
  const provider=vi.fn().mockResolvedValue({draft:replay.draft,model:config.model,response_id:"synthetic-replay-only",usage:null});
  expect(validateDraft(replay.draft,briefing).errors).toEqual(["REGIONAL_EXTRAPOLATION"]);
  const fallback=await generateOperational({briefing,config,store,provider,manualRetry:false});
  const original=archives.get(fallback.supersedes!)!;
  expect(original.validation.errors).toEqual(["REGIONAL_EXTRAPOLATION"]);
  expect(original.draft).toEqual(replay.draft);expect(fallback.mode).toBe("fallback");
  expect(fallback.validation.errors).toEqual([]);expect(consultableEdition(fallback).consultable).toBe(true);
  expect(run?.archive_id).toBe(fallback.edition_id);expect(run?.state).toBe("completed");
  expect(await archiveFactualFallback(original,store)).toEqual(fallback);
  expect(provider).toHaveBeenCalledTimes(1);expect(JSON.stringify(replay)).toBe(before);
  const facts=new Map(briefing.national.facts.map(f=>[f.id,f.text]));
  for(const block of fallback.draft.article)expect(block.text).toBe(facts.get(block.evidence_ids[0]));
  expect(fallback.draft.lead.text).toContain("prévisions issues des modèles");
  expect(fallback.draft.key_figures).toEqual([]);
 });
});
