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
import {dailyRequest,chooseDaily,type DailySelection} from "../editorial-map-selection/daily";
import {fallbackDraft} from "./fallback";

export interface AttemptStore {
 claimAttempt(run:Run,manualRetry:boolean):Promise<Run>;
 finishAttempt(run:Run):Promise<void>;
 diagnostic(id:string,value:unknown):Promise<void>;
 save(archive:Archive):Promise<void>;
 saveStandaloneFallback?(archive:Archive,reason:string):Promise<void>;
 read(id:string):Promise<Archive|null>;
}
/** Pricing is an optional diagnostic estimate; no balance, reservation or reconciliation gate. */
export function operationalConfig(model:string):AIConfig {
 if(!["gpt-6.1-terra","gpt-6-luna"].includes(model)) throw Error("MODEL_NOT_QUALIFIED");
 return {...readConfig({AGRICLIMAX_EDITORIAL_MODEL:model}),enabled:true,max_output_tokens:6000,timeout_ms:120000,
 request_profile:"gpt6-standard-explicit-cache",pricing:{model,version:"diagnostic-estimate-2026-11-09",verified_at:"2026-11-09",input_eur_per_million:model==="gpt-6.1-terra"?1.1:.11,output_eur_per_million:model==="gpt-6.1-terra"?5.5:.55}};
}
export async function generateOperational(o:{briefing:EditorialBriefingBundle;config:AIConfig;store:AttemptStore;provider:Provider;manualRetry:boolean;mapSelection?:DailySelection;prepareSelection?:(id:string)=>Promise<DailySelection>}) {
 const b=o.briefing,c=o.config;assertBriefing(b);
 if(b.territorial_watch?.length) throw Error("AGRO04_PREVIEW_ONLY");
 const now=new Date().toISOString();
 const proposed:Run={id:hash([b.edition_date,b.bundle_id,randomUUID()]),edition_date:b.edition_date,scope:"daily",month:now.slice(0,7),state:"running",reserved_eur:0,actual_eur:null,error:null,archive_id:null};
 const run=await o.store.claimAttempt(proposed,o.manualRetry);
 if(run.id!==proposed.id) {
  const existing=run.archive_id?await o.store.read(run.archive_id):null;
  if(!existing) throw Error("COMPLETED_ARCHIVE_MISSING");
  consultableEdition(existing);
  return existing;
 }
 let maps:DailySelection|undefined;
 let original:Archive|undefined;
 let archiving=false;
 let archive:Archive;
 let phase="MAP_SELECTION";
 try {
  const candidate=o.prepareSelection?await o.prepareSelection(run.id):o.mapSelection;
  const request=candidate?.ranking.ranked.some(r=>r.card.admission.eligible)?dailyRequest(candidate.ranking):undefined;
  if(candidate)await o.store.diagnostic(hash([run.id,"map-selection"]),{kind:"map_selection_request",run_id:run.id,selection:candidate});
  maps=candidate;
  phase="PROVIDER";
  const started=performance.now();
  const result=await o.provider(editorialPayload(b,[],request),c,{usageOptional:true,beforeRequest:async metadata=>{
   await o.store.diagnostic(hash([run.id,"request"]),{kind:"provider_request",run_id:run.id,metadata});
  }});
  // Preserve actual output before scientific/contract admission; diagnostics remain private.
  await o.store.diagnostic(hash([run.id,"response"]),{kind:"provider_response",run_id:run.id,received_at:new Date().toISOString(),result});
  if(result.usage&&result.model===c.model)run.actual_eur=cost(result.usage.input_tokens,result.usage.output_tokens,c.pricing);
  const envelope=result.draft as {draft?:unknown;map_selection?:unknown}|null;
  const selection=maps?chooseDaily(maps.ranking,maps.maps_sha256,envelope?.map_selection):undefined;
  phase="ARCHIVE";
  archiving=true;
  original=await archiveOperationalResult({...o,run,result:{...result,draft:request?envelope?.draft:result.draft},mapSelection:selection,generatedAt:now,durationMs:Math.round(performance.now()-started)});
  archive=original.validation.status==="rejected"?await archiveFactualFallback(original,o.store):original;
  consultableEdition(archive);
 } catch(error) {
  run.error=error instanceof ProviderFailure?error.code:`GENERATION_${phase}_FAILED`;
  if(error instanceof ProviderFailure) {
   await o.store.diagnostic(hash([run.id,"error"]),{kind:"provider_error",run_id:run.id,code:error.code,diagnostic:error.diagnostic??null,evidence:error.evidence??null})
    .catch(()=>console.warn("PROVIDER_ERROR_DIAGNOSTIC_FAILED"));
  }
  if(phase==="MAP_SELECTION") run.actual_eur=0;
  try {
   // An archive write may have committed before the response was lost.
   const saved=original??(archiving?await o.store.read(run.id):null);
   if(saved) {
    archive=saved.validation.status==="rejected"?await archiveFactualFallback(saved,o.store):saved;
   } else {
    archive=await archiveProviderFactualFallback({briefing:b,config:c,store:o.store,runId:run.id,generatedAt:now,mapSelection:maps});
   }
   consultableEdition(archive);
  } catch(failure) {
   await o.store.finishAttempt({...run,state:"outcome_unknown"});
   throw failure;
  }
 }
 await o.store.finishAttempt({...run,state:"completed",archive_id:archive.edition_id});
 return archive;
}

/** A new immutable archive, derived only from verified facts. Provider failures never reach here. */
export async function archiveFactualFallback(source:Archive,store:AttemptStore):Promise<Archive> {
 const draft=fallbackDraft(source.briefing),validation=validateDraft(draft,source.briefing,[]);
 if(validation.status==="rejected")throw Error("FACTUAL_FALLBACK_REJECTED");
 const {checksum,...body}=source;void checksum;
 const archive=sealArchive({...body,edition_id:hash([source.checksum,"experimental-factual-fallback-1"]),
  // Text rejection does not invalidate the independently checked map selection in body.
  revision:source.revision+1,supersedes:source.edition_id,mode:"fallback",draft,validation,status:validation.status,receipt:null,illustrations:[]});
 await store.save(archive);
 return archive;
}

/** Rebuild only from a persisted provider response; never invokes a provider. */
export async function archiveOperationalResult(o:{briefing:EditorialBriefingBundle;config:AIConfig;store:AttemptStore;run:Run;result:ProviderResult;generatedAt:string;durationMs:number;mapSelection?:DailySelection}) {
 const {briefing:b,config:c,run,result}=o;const now=o.generatedAt;
  if(result.model!==c.model||!result.response_id) throw Error("PROVIDER_MODEL_OR_ID_MISMATCH");
  let validation=validateDraft(result.draft,b,[]);
  if(validation.status==="rejected") {
   await o.store.diagnostic(hash([run.id,"validation"]),{kind:"scientific_validation",run_id:run.id,validation});
  }
  assertDraft(result.draft);
  let draft=result.draft;
  // An optional context paragraph can be discarded without paraphrasing its
  // unsupported claim. The provider response remains in the immutable diagnostics.
  if(validation.errors.length===1&&validation.errors[0]==="REGIONAL_EXTRAPOLATION"&&draft.article.filter(block=>block.kind==="fact").length>=3){
   for(const [index,block] of draft.article.entries()){
    if(block.kind!=="context")continue;
    const candidate={...draft,article:draft.article.filter((_,position)=>position!==index)};
    const checked=validateDraft(candidate,b,[]);
    if(checked.status==="rejected")continue;
    await o.store.diagnostic(hash([run.id,"localized-edit"]),{kind:"localized_editorial_edit",run_id:run.id,
     section:"article",index,removed:block,reason:"REGIONAL_EXTRAPOLATION",validation:checked});
    draft=candidate;
    validation=checked;
    break;
   }
  }
  const estimate=result.usage?cost(result.usage.input_tokens,result.usage.output_tokens,c.pricing):null;
  const archive=sealArchive({version:"editorial-archive-1",edition_id:run.id,revision:1,supersedes:null,date:b.edition_date,generated_at:now,
   ...(o.mapSelection?{map_selection:o.mapSelection}:{}),
   engine:ENGINE,prompt_version:PROMPT_VERSION,config_version:CONFIG_VERSION,mode:"live",status:validation.status,draft,briefing:b,illustrations:[],validation,
   receipt:{model:result.model,response_id:result.response_id,usage:result.usage,cost_eur:estimate,duration_ms:o.durationMs,pricing_version:c.pricing.version},
   prompt_sha256:hash(INSTRUCTIONS),parameters:{model:c.model,max_output_tokens:c.max_output_tokens,request_profile:c.request_profile}});
  await o.store.save(archive);
  return archive;
}

/** A provider failure has no prior archive: reuse its existing attempt FK, never create a paid attempt. */
export async function archiveProviderFactualFallback(o:{briefing:EditorialBriefingBundle;config:AIConfig;store:AttemptStore;runId:string;generatedAt:string;mapSelection?:DailySelection;standaloneReason?:string}) {
 const b=o.briefing,c=o.config,draft=fallbackDraft(b),validation=validateDraft(draft,b);
 const archive=sealArchive({version:"editorial-archive-1",edition_id:o.runId,revision:1,supersedes:null,date:b.edition_date,generated_at:o.generatedAt,
  engine:ENGINE,prompt_version:PROMPT_VERSION,config_version:CONFIG_VERSION,mode:"fallback",status:validation.status,draft,briefing:b,illustrations:[],validation,receipt:null,
  ...(o.mapSelection?{map_selection:chooseDaily(o.mapSelection.ranking,o.mapSelection.maps_sha256)}:{}),prompt_sha256:hash(INSTRUCTIONS),parameters:{model:c.model,max_output_tokens:c.max_output_tokens}});
 consultableEdition(archive);
 if(o.standaloneReason) {
  if(!o.store.saveStandaloneFallback)throw Error("STANDALONE_FALLBACK_STORE_REQUIRED");
  await o.store.saveStandaloneFallback(archive,o.standaloneReason);
 } else await o.store.save(archive);
 return archive;
}
