import {prepareDailySelection} from "./edit04_selection";
import {chooseDaily,type DailySelection} from "../apps/web/features/editorial-map-selection/daily";
import { prepareDossier } from "./nightly_prepare";
import {resumeArchivedEdition} from "../apps/web/features/nightly/resume-archive";
import { revalidateArchive, REVALIDATION_VERSION } from "../apps/web/features/editorial-ai/revalidate";
import { BriefingContractError } from "../apps/web/features/editorial/validate";
import { supervise } from "../apps/web/features/nightly/supervise";
/** Nightly last stage. All acquisition remains in Python/GitHub; no provider call from web reads. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parisDate } from "../apps/web/features/editorial/almanac";
import { verifySnapshot, type DailyEditorialSnapshot } from "../apps/web/features/nightly/snapshot";
import { editorialRPC, SupabaseEditorialStore, promoteEdition } from "../apps/web/features/editorial-ai/supabase-store";
import {archiveProviderFactualFallback,archiveFactualFallback,archiveOperationalResult,generateOperational,operationalConfig} from "../apps/web/features/editorial-ai/generate-operational";
import type { Archive } from "../apps/web/features/editorial-ai/model";
import type {Run} from "../apps/web/features/editorial-ai/archive";
import type {ProviderResult} from "../apps/web/features/editorial-ai/provider";
import {consultableEdition} from "../apps/web/features/editorial-ai/consultable";
import { hash } from "../apps/web/features/editorial/temporal";
import { readPublishedMaps } from "../apps/web/lib/server/edition-maps";
import {spawnSync} from "node:child_process";
import { openAIProvider } from "../apps/web/features/editorial-ai/provider";
const command = process.argv[2] ?? "preflight";
const date = process.env.AGRICLIMAX_EDITION_DATE || parisDate(new Date().toISOString());
if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>parisDate(new Date().toISOString())) throw Error("EDITION_DATE_REQUIRED");
let phase="admission";
function publishExperimentalMaps(archive:Archive|{edition_id:string}) {
 phase="experimental_maps";
 const result=spawnSync(process.execPath,["--conditions=react-server","apps/web/node_modules/tsx/dist/cli.mjs","scripts/int01_maps.ts","publish-experimental",archive.edition_id],{env:process.env,encoding:"utf8",timeout:300000,maxBuffer:1024*1024});
 if(result.status!==0)throw Error("EXPERIMENTAL_MAP_PUBLICATION_FAILED");
}
function failureCode(error:unknown) {
  const prefix=error instanceof Error?error.message.split(":")[0]:"";
  return /^[A-Z][A-Z0-9_]+$/.test(prefix)?prefix:"NIGHTLY_FAILED";
}
let resultForLedger: Record<string,unknown> = {};
const out = process.env.AGRICLIMAX_EDITORIAL_OUTPUT??"work/task36";
mkdirSync(out,{recursive:true});
function output(value: unknown) {
  writeFileSync(join(out,command+".json"),JSON.stringify(value,null,2)+"\n");
  const result=value as Record<string,unknown>;
  resultForLedger=result;
  const receipt={command,status:result.status??result.quality??"completed",edition_id:result.id??null,snapshot_id:result.snapshot_id??null,error:result.error??null};
  writeFileSync(join(out,"receipt.json"),JSON.stringify(receipt));
  // Detailed operational reports remain in the private Supabase diagnostic store.
  console.log(JSON.stringify(command==="report"?receipt:value));
}
async function prepare() {
 const newsPath=process.argv.indexOf("--news");
 return (await prepareDossier({date,out,readOnly:command==="prepare-offline",recover:process.argv.includes("--recover"),
   newsPath:newsPath>=0?process.argv[newsPath+1]:undefined,phase:value=>{phase=value;}})).snapshot;
}

async function main() {
  if(command==="revalidate") {
    phase="revalidation";
    const i=process.argv.indexOf("--source-checksum");
    if(i<0) throw Error("REVALIDATION_CHECKSUM_REQUIRED");
    const store=new SupabaseEditorialStore("");
    const original=await store.read(process.argv[3]??"");
    if(!original||original.date!==date) throw Error("REVALIDATION_SOURCE_REQUIRED");
    const revised=revalidateArchive(original,process.argv[i+1]);
    writeFileSync(join(out,"revalidated-archive.json"),JSON.stringify(revised));
    if(process.argv.includes("--execute-revalidation")) {
      await editorialRPC("revalidate_archive",{edition_date:date,source_id:original.edition_id,source_checksum:original.checksum,
        id:revised.edition_id,checksum:revised.checksum,validation_version:REVALIDATION_VERSION,archive:revised,archive_json:JSON.stringify(revised)});
      const restored=await store.read(revised.edition_id);
      if(restored?.checksum!==revised.checksum) throw Error("REVALIDATION_READBACK_FAILED");
    }
    output({status:process.argv.includes("--execute-revalidation")?"archive_revalidated":"revalidation_ready",id:revised.edition_id,
      checksum:revised.checksum,supersedes:original.edition_id,validation:revised.validation,paid_calls:0});return;
  }
  if(command==="report") { phase="health_report"; const report=await supervise(date); output(report); if(report.alerts.length) process.exitCode=2; return; }
  if(command==="promote") { output(await promoteEdition(process.argv[3]??"")); return; }
  if(command==="approve"||command==="reject") {
    const i=process.argv.indexOf("--review-checksum"),r=process.argv.indexOf("--reviewer");
    if(i<0||r<0) throw Error("EXPLICIT_EDITORIAL_REVIEW_REQUIRED");
    output(await editorialRPC("review",{id:process.argv[3],checksum:process.argv[i+1],reviewer:process.argv[r+1],decision:command==="approve"?"approved":"rejected"}));return;
  }
  if(command==="prepare-offline") {
    // Real remote archive reads, local snapshot only: no financial, schema or publication mutation.
    const snapshot=await prepare();
    output(snapshot); return;
  }
  phase="control";
  const control=await editorialRPC<{emergency_stop:boolean;ai_enabled:boolean}>("control");
  if(control.emergency_stop) {output({status:"no_op",reason:"emergency_stop",paid_calls:0});return;}
  phase="snapshot_read";
  let snapshot = await editorialRPC<DailyEditorialSnapshot|null>("snapshot_read",{edition_date:date});
  if(!snapshot && ["prepare","run","qualify"].includes(command)) {
    snapshot=await prepare();
    phase="freeze";
    await editorialRPC("freeze",{edition_date:date,snapshot,snapshot_json:JSON.stringify(snapshot)});
    const restored=await editorialRPC<DailyEditorialSnapshot|null>("snapshot_read",{edition_date:date});
    if(!restored&&snapshot.quality==="insufficient") {output({status:"no_op",reason:"insufficient_data",paid_calls:0,previous_retained:true});return;}
    if(!restored) throw Error("SNAPSHOT_READBACK_MISSING");
    verifySnapshot(restored);
    snapshot=restored; // a simultaneous owner may have frozen first
  }
  if(!snapshot) throw Error("FROZEN_SNAPSHOT_ABSENT");
  verifySnapshot(snapshot);
  if(command==="prepare") { output({snapshot_id:snapshot.id,quality:snapshot.quality,date}); return; }
  if(snapshot.quality==="insufficient" || !snapshot.briefing) { output({status:"no_op",reason:"insufficient_data",paid_calls:0,previous_retained:true}); return; }
  const config = operationalConfig(process.env.AGRICLIMAX_EDITORIAL_MODEL??"gpt-6.1-terra");
  const store = new SupabaseEditorialStore(snapshot.id,date);
  if(command==="preflight"||command==="qualify") {
    output({snapshot_id:snapshot.id,quality:snapshot.quality,facts:snapshot.briefing.national.facts.length,model:config.model,financial_control:"openai_project",
      api_key_present:!!process.env.OPENAI_API_KEY,control:await editorialRPC("control"),paid_calls:0});return;
  }
  if(command!=="run") throw Error("UNKNOWN_NIGHTLY_COMMAND");
  const authorized=process.argv.indexOf("--authorize-snapshot");
  if(authorized>=0&&process.argv[authorized+1]!==snapshot.id) throw Error("EXACT_SNAPSHOT_AUTHORIZATION_REQUIRED");
  // An interrupted process may have persisted the response before saving the
  // edition. Replay only that response through the same validator/archive engine.
  phase="edition_history";
  const history=await editorialRPC<{runs:Run[];publications:{archive_id:string}[];diagnostics:{kind?:string;run_id?:string;result?:ProviderResult;received_at?:string;metadata?:{started_at?:string};selection?:DailySelection}[]}>("edition_context",{edition_date:date});
  if(history.publications.length) {
    output({status:"no_op",reason:"already_consultable",id:history.publications[0].archive_id,paid_calls:0});return;
  }
  for(const prior of history.runs) {
    let recovered=await store.read(prior.archive_id??prior.id);
    const savedMaps=history.diagnostics.find(d=>d.kind==="map_selection_request"&&d.run_id===prior.id)?.selection;
    if(!recovered) {
      const saved=history.diagnostics.find(d=>d.kind==="provider_response"&&d.run_id===prior.id);
      const response=saved?.result;
      const generatedAt=saved?.received_at??history.diagnostics.find(d=>d.kind==="provider_request"&&d.run_id===prior.id)?.metadata?.started_at;
      if(response&&!generatedAt) throw Error("RECOVERY_TIMESTAMP_MISSING");
      if(response&&generatedAt) {
       const envelope=response.draft as {draft?:unknown;map_selection?:unknown}|null;
       const selection=savedMaps?chooseDaily(savedMaps.ranking,savedMaps.maps_sha256,envelope?.map_selection):undefined;
       try {recovered=await archiveOperationalResult({mapSelection:selection,briefing:snapshot.briefing,config,store,run:prior,result:{...response,draft:savedMaps?.ranking.ranked.some(r=>r.card.admission.eligible)?envelope?.draft:response.draft},
        generatedAt,durationMs:0});}catch(error){
        if(!(error instanceof Error)||!(error.message.startsWith("DRAFT_CONTRACT")||error.message==="PROVIDER_MODEL_OR_ID_MISMATCH"))throw error;
        recovered=await archiveProviderFactualFallback({briefing:snapshot.briefing,config,store,runId:prior.id,generatedAt,mapSelection:savedMaps});
       }
     } else if(["running","outcome_unknown"].includes(prior.state)) {
       const startedAt=history.diagnostics.find(d=>d.kind==="provider_request"&&d.run_id===prior.id)?.metadata?.started_at;
       recovered=await archiveProviderFactualFallback({briefing:snapshot.briefing,config,store,runId:prior.id,
        generatedAt:startedAt??snapshot.frozen_at,mapSelection:savedMaps??await prepareDailySelection(snapshot,prior.id)});
     }
    }
    if(recovered) {
      phase="archive_recovery";
      const publicState=prior.state==="completed"||(prior.state==="outcome_unknown"&&recovered.mode==="fallback");
      if(publicState && recovered.validation.status!=="rejected" && prior.archive_id===recovered.edition_id && await readPublishedMaps(recovered)) {
        output({status:"no_op",reason:"already_consultable",id:recovered.edition_id,checksum:recovered.checksum,paid_calls:0});return;
      }
      if(recovered.validation.status==="rejected"){
        const fallback=await archiveFactualFallback(recovered,store);
        publishExperimentalMaps(fallback);
        output({status:"experimental_fallback",id:fallback.edition_id,checksum:fallback.checksum,paid_calls:0});return;
      }
      if(recovered.mode==="fallback"&&recovered.edition_id===prior.id&&prior.archive_id!==recovered.edition_id){
       if(prior.state==="running")await store.finishAttempt({...prior,state:"completed",error:prior.error??"PROVIDER_INTERRUPTED",archive_id:recovered.edition_id});
       else await store.writeRun({...prior,archive_id:recovered.edition_id}); // Same-state attachment permitted by run_write; no financial transition.
      }
      output(await resumeArchivedEdition(recovered,payload=>editorialRPC("recover_archive",payload),publishExperimentalMaps));return;
    }
  }
  const key=process.env.OPENAI_API_KEY;
  const fallbackReason=!control.ai_enabled?"ai_disabled":!key?"openai_key_missing":null;
  phase="generation";
  let archive:Archive;
  if(fallbackReason) {
    if(history.runs.length) throw Error("EXISTING_ATTEMPT_REQUIRES_RECOVERY");
    const id=hash([snapshot.id,"standalone-factual-fallback-1"]);
    const selection=await prepareDailySelection(snapshot,id);
    archive=await archiveProviderFactualFallback({briefing:snapshot.briefing,config,store,runId:id,
      generatedAt:snapshot.frozen_at,mapSelection:selection,standaloneReason:fallbackReason});
  } else {
    archive=await generateOperational({briefing:snapshot.briefing,config,store,provider:openAIProvider(key!),manualRetry:false,
      prepareSelection:process.env.AGRICLIMAX_EDITORIAL_MAP_SELECTION==="false"?undefined:id=>prepareDailySelection(snapshot,id)});
  }
  const run=await store.readRun(archive.edition_id);
  consultableEdition(archive);
  publishExperimentalMaps(archive);
  output({id:archive.edition_id,mode:archive.mode,status:"consultable",
    validation_status:archive.status,provider_receipt_archived:!!archive.receipt,checksum:archive.checksum,run_state:run?.state,fallback_reason:fallbackReason,error:run?.error??null});
  // Archiving makes an experimental edition consultable. Certification/promotion remains explicit.
}
async function execute() {
  if(["prepare-offline","promote","approve","reject","revalidate"].includes(command)) {await main();return;}
  const owner=`${process.env.GITHUB_RUN_ID??"local"}-${process.env.GITHUB_RUN_ATTEMPT??"1"}-${crypto.randomUUID()}`;
  const metadata={edition_date:date,stage:command,command,owner,workflow_run_id:process.env.GITHUB_RUN_ID??null,
    dispatch_id:process.env.AGRICLIMAX_DISPATCH_ID??null,scheduled_at:process.env.AGRICLIMAX_SCHEDULED_AT??null,
    scheduled_at_basis:process.env.AGRICLIMAX_SCHEDULED_AT_BASIS??null};
  phase="stage_claim";
  const claim=await editorialRPC<{status?:string;reason?:string}>("stage_claim",metadata);
  if(claim.status==="no_op") {output(claim);return;}
  try {await main();}
  catch(error) {resultForLedger={status:"failed",error:failureCode(error),phase,error_type:error instanceof Error?error.name:"UnknownError",contract_diagnostics:error instanceof BriefingContractError?error.diagnostics:undefined};throw error;}
  finally {
    const state=resultForLedger.status==="failed"||process.exitCode?"failed":resultForLedger.status==="no_op"?"no_op":"completed";
    try {
      await editorialRPC("stage_finish",{...metadata,state,result:resultForLedger});
    } catch(error) {
      if(resultForLedger.status!=="failed") {phase="stage_finish";throw error;}
      console.error("STAGE_FINISH_FAILED");
    }
  }
}
execute().catch(error=>{output({status:"failed",error:failureCode(error),phase,error_type:error instanceof Error?error.name:"UnknownError",contract_diagnostics:error instanceof BriefingContractError?error.diagnostics:undefined,automatic_paid_retry:false});process.exitCode=1;});
