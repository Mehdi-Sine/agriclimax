import { revalidateArchive, REVALIDATION_VERSION } from "../apps/web/features/editorial-ai/revalidate";
import { BriefingContractError } from "../apps/web/features/editorial/validate";
import { supervise } from "../apps/web/features/nightly/supervise";
/** Nightly last stage. All acquisition remains in Python/GitHub; no provider call from web reads. */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { archiveInputs } from "../apps/web/features/nightly/immutable-inputs";
import { archiveCatalogue, nationalWeatherDocument, archivedEra5Day } from "../apps/web/lib/server/weather-archives";
import { nationalWatch } from "../apps/web/lib/server/national-watch";
import { buildEdition } from "../apps/web/features/journal/model";
import { adaptHistory, compareHistory, reconstructEpisodes, hash } from "../apps/web/features/editorial/temporal";
import { buildBriefing, briefingEvents, type BriefingInput, type NewsContext } from "../apps/web/features/editorial/briefing";
import { parisDate } from "../apps/web/features/editorial/almanac";
import { freezeSnapshot, verifySnapshot, cutoffUTC, selectCycles, modelFamily, POLICY, type Cycle, type DailyEditorialSnapshot } from "../apps/web/features/nightly/snapshot";
import { editorialRPC, SupabaseEditorialStore, promoteEdition, publishedEditions } from "../apps/web/features/editorial-ai/supabase-store";
import {archiveOperationalResult,generateOperational,operationalConfig} from "../apps/web/features/editorial-ai/generate-operational";
import type { Archive } from "../apps/web/features/editorial-ai/model";
import type {Run} from "../apps/web/features/editorial-ai/archive";
import type {ProviderResult} from "../apps/web/features/editorial-ai/provider";
import {consultableEdition} from "../apps/web/features/editorial-ai/consultable";
import { openAIProvider, verifyModel } from "../apps/web/features/editorial-ai/provider";
import { assessHistory, qualityLimitations } from "../apps/web/features/nightly/data-quality";
import geography from "../apps/web/data/operational/pra-watch-places.json";
const command = process.argv[2] ?? "preflight";
const date = process.env.AGRICLIMAX_EDITION_DATE || parisDate(new Date().toISOString());
if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>parisDate(new Date().toISOString())) throw Error("EDITION_DATE_REQUIRED");
let phase="admission";
function failureCode(error:unknown) {
  const prefix=error instanceof Error?error.message.split(":")[0]:"";
  return /^[A-Z][A-Z0-9_]+$/.test(prefix)?prefix:"NIGHTLY_FAILED";
}
let resultForLedger: Record<string,unknown> = {};
const out = "work/task36";
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
  const began=performance.now();
  const now = new Date().toISOString();
  const cutoff = process.argv.includes("--recover")&&parisDate(now)===date?now:cutoffUTC(date);
  phase="previous_editions";
  const previous:Archive[]=command==="prepare-offline"?[]:await publishedEditions();
  const prior=previous.filter(a=>a.date<date).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const previousTopicKeys=prior?.briefing.candidates.filter(c=>[prior.draft.main_candidate_id,...prior.draft.secondary_candidate_ids].includes(c.id)).map(c=>c.topic_key)??[];
  phase="catalogue";
  const catalogue = await archiveCatalogue();
  if(!catalogue) throw Error("NO_REAL_CATALOGUE");
  phase="history";
  const historyEntries = catalogue.era5.filter(e=>e.dates.some(d=>d<date));
  const dates = [...new Set(historyEntries.flatMap(e=>e.dates))].filter(d=>d<date).sort().slice(-60);
  const rows = [];
  for(const d of dates) {
    const e=historyEntries.find(e=>e.dates.includes(d));
    const daily=e?await archivedEra5Day(d,e):null;
    if(daily?.every(r=>Date.parse(r.computed_at)<=Date.parse(cutoff))) rows.push(...daily);
  }
  const historyCutoff = rows.map(r=>r.valid_date).sort().at(-1) ?? date;
  const history = adaptHistory(rows,geography.places,"nightly-era5-archive-1");
  const historyQuality = assessHistory(history,date);
  const comparisons = compareHistory(history,historyCutoff,geography.places);
  const episodes = reconstructEpisodes(history,historyCutoff);
  phase="acquisition_report";
  const report=command==="prepare-offline" ? {acquisitions:[]} : await editorialRPC<{acquisitions:{source:string;state:string;edition_date:string;checkpoint:{report?:NewsContext}}[]}>("report",{edition_date:date});
  phase="forecast";
  const candidates = [...catalogue.weather].sort((a,b)=>(b.run_at??b.run_date!).localeCompare(a.run_at??a.run_date!));
  let forecast: {doc: NonNullable<Awaited<ReturnType<typeof nationalWeatherDocument>>>; entry: typeof candidates[number]; cycles: Cycle[]} | undefined;
  // Bounded fallback search; every candidate is fully decoded by the existing scientific validator.
  for(const entry of candidates.slice(0,8)) {
    let doc;
    try { doc=await nationalWeatherDocument(entry.run_at??entry.run_date,entry.sha256); }
    catch {
      writeFileSync(join(out,`quarantine-${entry.sha256}.json`),JSON.stringify({archive:entry,status:"quarantined",reason:"ARCHIVE_VALIDATION_FAILED"}));
      continue;
    }
    if(!doc || Date.parse(doc.acquired_at)>Date.parse(cutoff)) continue;
    const groups = new Map<string,Cycle>();
    for(const row of doc.selected_indices.map(i=>doc.rows[i]).filter(r=>r.nature==="forecast" && r.model_run_at && r.valid_date>=date)) {
      const key = row.model+row.model_run_at;
      let c = groups.get(key);
      if(!c) {
        c = {provider:row.source_id,model:row.model,emitted_at:row.model_run_at!,acquired_at:doc.acquired_at,
          valid_dates:[],variables:[],pra_count:713,quality:"qualified",continuity:true,
          archive:{path:entry.path,sha256:entry.sha256},source_version:entry.method_version!,
          support_qualification:["CORE-01","partial_and_unavailable_preserved"]};
        groups.set(key,c);
      }
      if(!c.valid_dates.includes(row.valid_date)) c.valid_dates.push(row.valid_date);
      if(!c.variables.includes(row.variable)) c.variables.push(row.variable);
    }
    const cycles = [...groups.values()].map(c=>({...c,valid_dates:c.valid_dates.sort(),variables:c.variables.sort()}));
    const selected = selectCycles(cycles,date,cutoff);
    if(selected.quality==="insufficient") continue;
    // Every selected forecast row used by existing detectors must remain within source-specific age limits.
    const usedRows=doc.selected_indices.map(i=>doc.rows[i]).filter(r=>r.valid_date>=date);
    if(usedRows.some(r=>{const family=modelFamily(r.model); return !family || !r.model_run_at ||
      Date.parse(cutoff)-Date.parse(r.model_run_at)>POLICY.max_age_hours[family]*3600000;})) continue;
    forecast={doc,entry,cycles};
    break;
  }
  const cycles=forecast?.cycles??[];
  const selected=selectCycles(cycles,date,cutoff);
  const edition=forecast?buildEdition(await nationalWatch(forecast.doc.run,forecast.doc),{now}):undefined;
    const archivedNews=report.acquisitions.find(a=>a.source==="news"&&a.edition_date===date)?.checkpoint.report;
    const newsPath = process.argv.indexOf("--news");
    let news = newsPath>=0 ? JSON.parse(readFileSync(process.argv[newsPath+1],"utf8")) as NewsContext : archivedNews;
    if(news && Date.parse(news.generated_at)>Date.parse(cutoff)) news=undefined;
    const base:BriefingInput={date,generated_at:now,history_cutoff:historyCutoff,
      source_fingerprint:hash([forecast?.entry??null,historyEntries]),history,comparisons,episodes,episode_archive_sha256:hash(episodes),edition,previous_topic_keys:previousTopicKeys};
    if(news) {
      const events=briefingEvents(base);
      const matched=spawnSync(process.env.PYTHON??"python",["scripts/task33_news_links.py"],{
        input:JSON.stringify({news,events:[...events.historical.map(({episodes,...e})=>{void episodes;return e;}),
          ...events.forecast.map(e=>({id:e.id,phenomenon:e.phenomenon,region:e.region,period:e.period,production_ids:e.production_ids,provenance:e.evidence_ids}))]}),
        encoding:"utf8",timeout:30000,maxBuffer:8*1024**2});
      if(matched.status===0) base.news={...news,links:JSON.parse(matched.stdout)};
      // Documentary failure is explicit, never a reason to invent a scientific confirmation.
    }
    phase="briefing";
    const briefing=buildBriefing(base);
    if(!base.news) briefing.limitations.push("Lot documentaire T34 indisponible ou non qualifié avant cutoff ; aucune confirmation documentaire ajoutée.");
    briefing.limitations.push(...cycles.map(c=>`Prévisions ${c.model} émises le ${c.emitted_at}, acquises le ${c.acquired_at}; validité ${c.valid_dates[0]}–${c.valid_dates.at(-1)}.`));
    if(selected.quality==="fallback_valid") briefing.limitations.push("Cycle antérieur encore valide : ne pas affirmer une évolution observée sans nouvelle observation comparable.");
    briefing.limitations.push(...qualityLimitations(historyQuality,!!forecast,report.acquisitions));
    briefing.bundle_id=hash({...briefing,bundle_id:undefined});
    // Immutable inputs retained alongside snapshot. Existing methods are reused without changing science.
    const inputs = {catalogue,document:forecast?.doc??null,quality:historyQuality,acquisitions:report.acquisitions,history:rows,episodes,comparisons,news:news??null,previous_edition:prior?{id:prior.edition_id,date:prior.date,checksum:prior.checksum}:null};
    writeFileSync(join(out,"frozen-inputs.json"),JSON.stringify(inputs));
    phase="snapshot";
    const snapshot = freezeSnapshot(date,cycles,briefing,now,historyQuality,cutoff);
    phase="input_archive";
    snapshot.input_archive = command==="prepare-offline" ? null : await archiveInputs(inputs);
    const {id: unused,...body}=snapshot; void unused;
    snapshot.id=hash(body);
    writeFileSync(join(out,"preparation-metrics.json"),JSON.stringify({date,snapshot_id:snapshot.id,
      quality:snapshot.quality,forecast_archive:forecast?.entry.sha256??null,history_rows:rows.length,
      facts:briefing.national.facts.length,elapsed_seconds:(performance.now()-began)/1000,
      rss_mib:process.memoryUsage().rss/1024**2,read_only:command==="prepare-offline",openai_calls:0}));
    return snapshot;
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
  if(command==="report") { const report=await supervise(date); output(report); if(report.alerts.length) process.exitCode=2; return; }
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
  const control=await editorialRPC<{emergency_stop:boolean;ai_enabled:boolean}>("control");
  if(control.emergency_stop) {output({status:"no_op",reason:"emergency_stop",paid_calls:0});return;}
  if(command==="run") {
    const {operationalEditions,sharedArchiveRead}=await import("../apps/web/lib/server/editorial-published");
    const existing=(await operationalEditions()).find(a=>a.date===date);
    if(existing&&sharedArchiveRead(existing.edition_id)){output({status:"no_op",reason:"already_consultable",id:existing.edition_id,checksum:existing.checksum,paid_calls:0});return;}
  }
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
  const store = new SupabaseEditorialStore(snapshot.id);
  if(command==="preflight"||command==="qualify") {
    output({snapshot_id:snapshot.id,quality:snapshot.quality,facts:snapshot.briefing.national.facts.length,model:config.model,financial_control:"openai_project",
      api_key_present:!!process.env.OPENAI_API_KEY,control:await editorialRPC("control"),paid_calls:0});return;
  }
  if(command!=="run") throw Error("UNKNOWN_NIGHTLY_COMMAND");
  const authorized=process.argv.indexOf("--authorize-snapshot");
  if(authorized>=0&&process.argv[authorized+1]!==snapshot.id) throw Error("EXACT_SNAPSHOT_AUTHORIZATION_REQUIRED");
  // An interrupted process may have persisted the response before saving the
  // edition. Replay only that response through the same validator/archive engine.
  const history=await editorialRPC<{runs:Run[];diagnostics:{kind?:string;run_id?:string;result?:ProviderResult;received_at?:string;metadata?:{started_at?:string}}[]}>("report",{edition_date:date});
  for(const prior of history.runs.filter(r=>r.edition_date===date)) {
    let recovered=await store.read(prior.archive_id??prior.id);
    if(!recovered) {
      const saved=history.diagnostics.find(d=>d.kind==="provider_response"&&d.run_id===prior.id);
      const response=saved?.result;
      const generatedAt=saved?.received_at??history.diagnostics.find(d=>d.kind==="provider_request"&&d.run_id===prior.id)?.metadata?.started_at;
      if(response&&!generatedAt) throw Error("RECOVERY_TIMESTAMP_MISSING");
      if(response&&generatedAt) recovered=await archiveOperationalResult({briefing:snapshot.briefing,config,store,run:prior,result:response,
        generatedAt,durationMs:0});
    }
    if(recovered) {
      if(recovered.validation.status==="rejected"&&authorized>=0) continue;
      consultableEdition(recovered);
      await editorialRPC("recover_archive",{edition_date:date,id:prior.id,checksum:recovered.checksum});
      output({status:"archive_recovered",id:prior.id,checksum:recovered.checksum,paid_calls:0});return;
    }
  }
  if(!control.ai_enabled) {output({status:"no_op",reason:"ai_disabled",snapshot_id:snapshot.id,quality:snapshot.quality,paid_calls:0});return;}
  const key=process.env.OPENAI_API_KEY;
  if(!key) throw Error("OPENAI_API_KEY_MISSING");
  await verifyModel(key,config.model);
  const archive=await generateOperational({briefing:snapshot.briefing,config,store,provider:openAIProvider(key),manualRetry:authorized>=0});
  const run=await store.readRun(archive.edition_id);
  output({id:archive.edition_id,mode:archive.mode,status:archive.mode==="live"?"consultable":"provider_failed",
    validation_status:archive.status,provider_receipt_archived:!!archive.receipt,checksum:archive.checksum,run_state:run?.state,error:run?.error??null});
  if(archive.mode!=="live"||!archive.receipt) {process.exitCode=2;return;}
  // Archiving makes an experimental edition consultable. Certification/promotion remains explicit.
}
async function execute() {
  if(["prepare-offline","promote","approve","reject","revalidate"].includes(command)) {await main();return;}
  const owner=`${process.env.GITHUB_RUN_ID??"local"}-${process.env.GITHUB_RUN_ATTEMPT??"1"}-${crypto.randomUUID()}`;
  const metadata={edition_date:date,stage:command,command,owner,workflow_run_id:process.env.GITHUB_RUN_ID??null,
    dispatch_id:process.env.AGRICLIMAX_DISPATCH_ID??null,scheduled_at:process.env.AGRICLIMAX_SCHEDULED_AT??null,
    scheduled_at_basis:process.env.AGRICLIMAX_SCHEDULED_AT_BASIS??null};
  const claim=await editorialRPC<{status?:string;reason?:string}>("stage_claim",metadata);
  if(claim.status==="no_op") {output(claim);return;}
  try {await main();}
  catch(error) {resultForLedger={status:"failed",error:failureCode(error),phase,error_type:error instanceof Error?error.name:"UnknownError",contract_diagnostics:error instanceof BriefingContractError?error.diagnostics:undefined};throw error;}
  finally {
    const state=resultForLedger.status==="failed"||process.exitCode?"failed":resultForLedger.status==="no_op"?"no_op":"completed";
    await editorialRPC("stage_finish",{...metadata,state,result:resultForLedger});
  }
}
execute().catch(error=>{output({status:"failed",error:failureCode(error),phase,error_type:error instanceof Error?error.name:"UnknownError",contract_diagnostics:error instanceof BriefingContractError?error.diagnostics:undefined,automatic_paid_retry:false});process.exitCode=1;});
