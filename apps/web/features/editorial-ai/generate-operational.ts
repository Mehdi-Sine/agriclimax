import "server-only";
import {randomUUID} from "node:crypto";
import {hash} from "../editorial/temporal";
import {assertBriefing} from "../editorial/validate";
import type {EditorialBriefingBundle} from "../editorial/briefing";
import type {Run} from "./archive";
import {sealArchive} from "./archive";
import type {Archive} from "./model";
import {ENGINE,PROMPT_VERSION,CONFIG_VERSION} from "./model";
import {INSTRUCTIONS} from "./prompt";
import {validateDraft,assertDraft} from "./validate";
import {editorialPayload} from "./budget";
import {readConfig,cost,type AIConfig} from "./config";
import {ProviderFailure,type Provider,type ProviderResult} from "./provider";
import {consultableEdition} from "./consultable";
import {fallbackDraft} from "./fallback";

export interface AttemptStore {
 claimAttempt(run:Run,manualRetry:boolean):Promise<Run>;
 finishAttempt(run:Run):Promise<void>;
 diagnostic(id:string,value:unknown):Promise<void>;
 save(archive:Archive):Promise<void>;
 read(id:string):Promise<Archive|null>;
}
/** Pricing is an optional diagnostic estimate; no balance, reservation or reconciliation gate. */
export function operationalConfig(model:string):AIConfig {
 if(!["gpt-6.1-terra","gpt-6-luna"].includes(model)) throw Error("MODEL_NOT_QUALIFIED");
 return {...readConfig({AGRICLIMAX_EDITORIAL_MODEL:model}),enabled:true,max_output_tokens:6000,timeout_ms:120000,
 request_profile:"gpt6-standard-explicit-cache",pricing:{model,version:"diagnostic-estimate-2026-11-09",verified_at:"2026-11-09",input_eur_per_million:model==="gpt-6.1-terra"?1.1:.11,output_eur_per_million:model==="gpt-6.1-terra"?5.5:.55}};
}
export async function generateOperational(o:{briefing:EditorialBriefingBundle;config:AIConfig;store:AttemptStore;provider:Provider;manualRetry:boolean}) {
 const b=o.briefing,c=o.config;assertBriefing(b);
 const now=new Date().toISOString();
 const proposed:Run={id:hash([b.edition_date,b.bundle_id,randomUUID()]),edition_date:b.edition_date,scope:"daily",month:now.slice(0,7),state:"running",reserved_eur:0,actual_eur:null,error:null,archive_id:null};
 const run=await o.store.claimAttempt(proposed,o.manualRetry);
 if(run.id!==proposed.id) {
  const existing=run.archive_id?await o.store.read(run.archive_id):null;
  if(!existing) throw Error("COMPLETED_ARCHIVE_MISSING");
  consultableEdition(existing);
  return existing;
 }
 const started=performance.now();
 try {
  const result=await o.provider(editorialPayload(b),c,{usageOptional:true,beforeRequest:async metadata=>{
   await o.store.diagnostic(hash([run.id,"request"]),{kind:"provider_request",run_id:run.id,metadata});
  }});
  // Preserve actual output before scientific/contract admission; diagnostics remain private.
  await o.store.diagnostic(hash([run.id,"response"]),{kind:"provider_response",run_id:run.id,received_at:new Date().toISOString(),result});
  const original=await archiveOperationalResult({...o,run,result,generatedAt:now,durationMs:Math.round(performance.now()-started)});
  const archive=original.validation.status==="rejected"?await archiveFactualFallback(original,o.store):original;
  const validation=archive.validation,estimate=original.receipt?.cost_eur??null;
  run.state=validation.status==="rejected"?"validation_failed":"completed";run.error=validation.status==="rejected"?"DRAFT_REJECTED":null;run.archive_id=archive.edition_id;run.actual_eur=estimate;
  await o.store.finishAttempt(run);
  // A rejected provider text is retained privately; only the checked factual replacement is admitted.
  if(validation.status==="rejected") throw Error("INCOMPATIBLE_EDITORIAL_DATA");
  consultableEdition(archive);
  return archive;
 } catch(error) {
  if(run.state==="running") {
   run.state="outcome_unknown";run.error=error instanceof ProviderFailure?error.code:"PROVIDER_OR_ARCHIVE_FAILED";
   if(error instanceof ProviderFailure) await o.store.diagnostic(hash([run.id,"error"]),{kind:"provider_error",run_id:run.id,code:error.code,diagnostic:error.diagnostic??null,evidence:error.evidence??null});
   await o.store.finishAttempt(run);
  }
  throw error;
 }
}

/** A new immutable archive, derived only from verified facts. Provider failures never reach here. */
export async function archiveFactualFallback(source:Archive,store:AttemptStore):Promise<Archive> {
 const draft=fallbackDraft(source.briefing),validation=validateDraft(draft,source.briefing,[]);
 if(validation.status==="rejected")throw Error("FACTUAL_FALLBACK_REJECTED");
 const {checksum,...body}=source;void checksum;
 const archive=sealArchive({...body,edition_id:hash([source.checksum,"experimental-factual-fallback-1"]),
  revision:source.revision+1,supersedes:source.edition_id,mode:"fallback",draft,validation,status:validation.status,receipt:null,illustrations:[]});
 await store.save(archive);
 return archive;
}

/** Rebuild only from a persisted provider response; never invokes a provider. */
export async function archiveOperationalResult(o:{briefing:EditorialBriefingBundle;config:AIConfig;store:AttemptStore;run:Run;result:ProviderResult;generatedAt:string;durationMs:number}) {
 const {briefing:b,config:c,run,result}=o;const now=o.generatedAt;
  if(result.model!==c.model||!result.response_id) throw Error("PROVIDER_MODEL_OR_ID_MISMATCH");
  const validation=validateDraft(result.draft,b,[]);
  if(validation.status==="rejected") {
   await o.store.diagnostic(hash([run.id,"validation"]),{kind:"scientific_validation",run_id:run.id,validation});
  }
  assertDraft(result.draft);
  const estimate=result.usage?cost(result.usage.input_tokens,result.usage.output_tokens,c.pricing):null;
  const archive=sealArchive({version:"editorial-archive-1",edition_id:run.id,revision:1,supersedes:null,date:b.edition_date,generated_at:now,
   engine:ENGINE,prompt_version:PROMPT_VERSION,config_version:CONFIG_VERSION,mode:"live",status:validation.status,draft:result.draft,briefing:b,illustrations:[],validation,
   receipt:{model:result.model,response_id:result.response_id,usage:result.usage,cost_eur:estimate,duration_ms:o.durationMs,pricing_version:c.pricing.version},
   prompt_sha256:hash(INSTRUCTIONS),parameters:{model:c.model,max_output_tokens:c.max_output_tokens,request_profile:c.request_profile}});
  await o.store.save(archive);
  return archive;
}
