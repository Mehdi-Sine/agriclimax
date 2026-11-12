/** OPS-04 manual owner. dry-run writes only the selected local artifact directory. */
import {mkdirSync,readFileSync,writeFileSync,existsSync,readdirSync,appendFileSync} from "node:fs";
import {join,resolve} from "node:path";
import {spawnSync} from "node:child_process";
import {createHash,randomUUID} from "node:crypto";
import {gzipSync} from "node:zlib";
import {BriefingContractError} from "../apps/web/features/editorial/validate";
import {manualOptions,generationDecision,productionSnapshot} from "../apps/web/features/nightly/manual-policy";
import {archiveInputs} from "../apps/web/features/nightly/immutable-inputs";
import {prepareDossier} from "./nightly_prepare";
import {recomputeIndicators} from "./manual_indicators";
import {archivedEra5Day,decodeNationalWeather,type ArchiveEntry} from "../apps/web/lib/server/weather-archives";
import {editorialRPC,SupabaseEditorialStore} from "../apps/web/features/editorial-ai/supabase-store";
import {verifySnapshot,type DailyEditorialSnapshot} from "../apps/web/features/nightly/snapshot";
import {verifyArchive,sealArchive,type Run} from "../apps/web/features/editorial-ai/archive";
import {validateDraft} from "../apps/web/features/editorial-ai/validate";
import {fallbackDraft} from "../apps/web/features/editorial-ai/fallback";
import {ENGINE,PROMPT_VERSION,CONFIG_VERSION,type Archive} from "../apps/web/features/editorial-ai/model";
import {hash} from "../apps/web/features/editorial/temporal";
import {operationalConfig} from "../apps/web/features/editorial-ai/generate-operational";
import {INSTRUCTIONS} from "../apps/web/features/editorial-ai/prompt";

const root=resolve(process.env.AGRICLIMAX_MANUAL_OUTPUT??`work/manual-journal/${process.env.GITHUB_RUN_ID??randomUUID()}-${process.env.GITHUB_RUN_ATTEMPT??1}`);
mkdirSync(root,{recursive:true});
function readOptions(){
 try{return manualOptions(Object.fromEntries(["edition_date","mode","refresh_sources","recompute_indicators","reuse_ai","force_ai_regeneration","authorized_snapshot","regeneration_reason"].map(k=>[k,process.env['MANUAL_'+k.toUpperCase()]])));}catch(error){
  const code=error instanceof Error?error.message:"INVALID_MANUAL_OPTIONS";
  const failure={version:"manual-journal-report-1",status:"failed",phase:"input_validation",blockers:[code],openai:{calls:0}};
  writeFileSync(join(root,"report.json"),JSON.stringify(failure));
  const summary="## AgriclimaX — exécution refusée\n\nParamètres invalides : "+code+"\nAucun appel OpenAI ni changement de publication.\n";
  writeFileSync(join(root,"summary.md"),summary);if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
  throw error;
 }
}
const options=readOptions();
const preview=join(root,"preview");mkdirSync(join(preview,"editions"),{recursive:true});
let phase="inspect";
const deadline=Date.now()+25*60000;
const report:Record<string,unknown>={version:"manual-journal-report-1",code_commit:process.env.GITHUB_SHA??null,workflow_run_id:process.env.GITHUB_RUN_ID??null,edition_date:options.edition_date,mode:options.mode,options,started_at:new Date().toISOString(),phase,acquisitions:[],freshness:[],coverage:null,indicators:{status:"not_requested",calculated:0,errors:[]},snapshot:null,openai:{status:"not_called",calls:0},validation:null,publication:{status:options.mode==="dry-run"?"not_requested":"pending"},consultation:{status:"not_checked"},blockers:[]};
function save(name:string,value:unknown){writeFileSync(join(root,name),JSON.stringify(value,null,2)+'\n');}
function run(stage:string,args:string[]=[]) {
 const result=spawnSync(resolve("apps/web/node_modules/.bin/tsx"),["scripts/task36_editorial.ts",stage,...args],{env:{...process.env,AGRICLIMAX_EDITION_DATE:options.edition_date,AGRICLIMAX_EDITORIAL_OUTPUT:join(root,stage)},encoding:"utf8",timeout:Math.max(1,Math.min(22*60000,deadline-Date.now()-60000)),maxBuffer:1024*1024});
 // Do not upload arbitrary exception output or provider payloads.
 return {exit_code:result.status??1,receipt:existsSync(join(root,stage,'receipt.json'))?JSON.parse(readFileSync(join(root,stage,'receipt.json'),'utf8')) as Record<string,unknown>:null};
}
function files(dir:string):string[]{return existsSync(dir)?readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]):[];}
async function main() {
 const date=options.edition_date;
 const before=await editorialRPC<{acquisitions:{source:string;state:string;checkpoint?:{report?:Record<string,unknown>}}[];runs:Run[];publications:{edition_date:string;archive_id:string}[]}>("report",{edition_date:date});
 const control=await editorialRPC<{emergency_stop:boolean;publication_enabled:boolean}>("control");
 const existing=await editorialRPC<DailyEditorialSnapshot|null>("snapshot_read",{edition_date:date});
 if(existing)verifySnapshot(existing);
 const store=new SupabaseEditorialStore(existing?.id??"");
 const originals:Archive[]=[];
 for(const run of before.runs.filter(r=>r.edition_date===date)) {
  const a=await store.read(run.archive_id??run.id);if(a)originals.push(a);
 }
 originals.sort((a,b)=>b.revision-a.revision||b.generated_at.localeCompare(a.generated_at));
 const beforeState={snapshot:existing?.id??null,archives:originals.map(a=>({id:a.edition_id,checksum:a.checksum})),publications:before.publications};save('before.json',beforeState);
 report.acquisitions=before.acquisitions.map(a=>({source:a.source,status:"reused",ledger_state:a.state,
  last_attempt_reference:Object.fromEntries(['date','from','to','run','generated_at','error_type','substage'].flatMap(k=>a.checkpoint?.report?.[k]===undefined?[]:[[k,a.checkpoint.report[k]]])),
  source_days:Array.isArray(a.checkpoint?.report?.days)?a.checkpoint.report.days.map(d=>{const row=d as Record<string,unknown>;return Object.fromEntries(['date','status','quality_flags','available_count','observation_count'].map(k=>[k,row[k]??null]));}):[],
 }));
 if(control.emergency_stop&&(options.mode!=='dry-run'||options.refresh_sources)){report.blockers=['EMERGENCY_STOP'];return;}
 const newsFile=join(root,"news.json");
 const archivedNews=before.acquisitions.find(a=>a.source==="news")?.checkpoint?.report;
 if(archivedNews)writeFileSync(newsFile,JSON.stringify(archivedNews));
 let extraWeather:Parameters<typeof prepareDossier>[0]['extraWeather'];let extraHistory:Parameters<typeof prepareDossier>[0]['extraHistory'];
 if(options.refresh_sources) {
  phase="local_acquisition";
  const acquisitionRoot=join(root,'sources');
  const child=spawnSync(process.env.PYTHON??'python',['scripts/manual_sources.py','--edition-date',date,'--root',acquisitionRoot],{env:process.env,encoding:'utf8',timeout:21*60000,maxBuffer:1024*1024});
  if(child.status!==0)throw Error('LOCAL_ACQUISITION_OWNER_FAILED');
  report.acquisitions=JSON.parse(readFileSync(join(acquisitionRoot,'results.json'),'utf8'));
  if(existsSync(join(acquisitionRoot,'news.json')))writeFileSync(newsFile,readFileSync(join(acquisitionRoot,'news.json')));
  const packed=files(join(acquisitionRoot,'forecast')).filter(f=>f.endsWith('cycle.compact.json.gz')).sort().at(-1);
  if(packed){const raw=readFileSync(packed),sha=createHash('sha256').update(raw).digest('hex'),document=decodeNationalWeather(raw,sha);extraWeather={document,entry:{path:`weather/${sha}.json.gz`,sha256:sha,bytes:raw.length,dates:[...new Set(document.rows.map(r=>r.valid_date))],run_date:document.run.slice(0,10),run_at:document.run,method_version:'pra-national-weather-daily-1',pra_count:713}};}
  const era5Report=join(acquisitionRoot,'era5/report.json');
  if(existsSync(era5Report)){const receipt=JSON.parse(readFileSync(era5Report,'utf8')) as {date?:string};const pack=files(join(acquisitionRoot,'era5')).find(f=>f.endsWith('/exact.json.gz'));
   if(pack&&receipt.date){const raw=readFileSync(pack),sha=createHash('sha256').update(raw).digest('hex');const entry:ArchiveEntry={path:`era5/${sha}.json.gz`,sha256:sha,bytes:raw.length,dates:[receipt.date]};extraHistory=await archivedEra5Day(receipt.date,entry,raw)??undefined;}}
 }
 let indicators:Awaited<ReturnType<typeof recomputeIndicators>>|undefined;
 let snapshot=existing;
 let capturedInputs:unknown;
 if(!snapshot||options.recompute_indicators||options.refresh_sources) {
  phase="test_preparation";
  const prepared=await prepareDossier({date,out:root,readOnly:true,testOnly:true,persistInputs:false,recover:true,extraWeather,extraHistory,newsPath:existsSync(newsFile)?newsFile:undefined,
   calculate:options.recompute_indicators?async(rows,document)=>{indicators=await recomputeIndicators(rows,document,date);return indicators.contributions;}:undefined});
  capturedInputs={...prepared.inputs,manual_indicators:indicators?{version:indicators.version,groups:indicators.groups.map(({batch,...g})=>({...g,rule_version:batch.version}))}:null};
  snapshot=prepared.snapshot;writeFileSync(join(root,'frozen-inputs.json.gz'),gzipSync(JSON.stringify(prepared.inputs))); // Captured inputs, never provider grids.
 }
 if(!snapshot)throw Error('SNAPSHOT_ABSENT');verifySnapshot(snapshot,true);save('test-snapshot.json',snapshot);
 if(indicators){
  const maps=indicators.groups.flatMap(g=>[...new Set(g.batch.measurements.map(m=>m.indicator))].map(key=>{
   const applicable=g.batch.measurements.filter(m=>m.indicator===key),first=applicable[0],measurements=applicable.filter(m=>m.production===first.production);
   return {id:hash([g.input_sha256,key,first.signature]),production:[...new Set(applicable.map(m=>m.production))].join(", "),indicator:first.indicator,nature:g.nature,period:g.period,unit:first.result.unit,source_sha256:g.input_sha256,rows:measurements.map(m=>{const r=m.result;return {territoryId:r.territoryId,value:r.value,observed_value:r.observed_value??null,status:r.status,reason:r.reason,support_scope:r.support_scope,spatial_coverage:r.spatial_coverage,temporal_coverage:r.temporal_coverage,data_freshness:r.data_freshness,rule_version:r.rule_version,quality_flags:r.quality_flags,provenance:r.provenance};})};
  }));
  const mapBytes=gzipSync(JSON.stringify(maps));writeFileSync(join(root,'maps.json.gz'),mapBytes);save('maps-manifest.json',{sha256:createHash('sha256').update(mapBytes).digest('hex'),bytes:mapBytes.length});
  writeFileSync(join(root,'indicators.json.gz'),gzipSync(JSON.stringify({version:indicators.version,measurements:indicators.measurements,errors:indicators.errors,groups:indicators.groups.map(({batch,...g})=>({...g,metrics:batch.metrics,rule_version:batch.version}))})));report.indicators={status:indicators.errors.length?'insufficient':'calculated',calculated:indicators.measurements,errors:indicators.errors,groups:indicators.groups.map(g=>({nature:g.nature,period:g.period,input_sha256:g.input_sha256,metrics:g.batch.metrics}))};}
 report.snapshot={id:snapshot.id,quality:snapshot.quality,status:existing?.id===snapshot.id?'reused_frozen':'isolated_test',production_id:existing?.id??null};
 report.freshness={history:snapshot.briefing?.validity,forecasts:snapshot.sources.map(s=>({model:s.model,emitted_at:s.emitted_at,acquired_at:s.acquired_at,valid_dates:s.valid_dates}))};
 report.coverage=snapshot.data_quality??snapshot.briefing?.national.coverage??null;
 const compatible=originals.find(a=>a.mode==='live'&&!!a.receipt&&a.briefing.bundle_id===snapshot!.briefing?.bundle_id&&validateDraft(a.draft,a.briefing,a.illustrations).status!=='rejected');
 const reused=options.reuse_ai?compatible:undefined;
 const decision=generationDecision(options,{snapshot_id:snapshot.id,compatible_ai:!!compatible,published:before.publications.some(p=>p.edition_date===date),quality:snapshot.quality});
 report.decision=decision;
 if(reused)save("compatible-ai-archive.json",reused);
 let archive=reused?.mode==="live"?undefined:reused;
 if(snapshot.briefing&&!archive){
  const briefing=snapshot.briefing,draft=fallbackDraft(briefing);
  for(const production of draft.productions){
   const facts=briefing.contributions.filter(c=>c.production===production.production_id).map(c=>briefing.national.facts.find(f=>f.id===c.fact_id)!);
   const size=Math.max(1,Math.ceil(facts.length/4));
   production.blocks=Array.from({length:Math.ceil(facts.length/size)},(_,i)=>{const selected=facts.slice(i*size,(i+1)*size);return {kind:'fact' as const,text:selected.map(f=>f.text).join(' '),evidence_ids:selected.map(f=>f.id),seasonal_ids:[]};});
  }
  const validation=validateDraft(draft,briefing);
  const config=operationalConfig('gpt-6.1-terra');
  archive=sealArchive({version:'editorial-archive-1',edition_id:hash([snapshot.id,'manual-preview',draft]),revision:1,supersedes:null,date,generated_at:new Date().toISOString(),engine:ENGINE,prompt_version:PROMPT_VERSION,config_version:CONFIG_VERSION,mode:'fallback',status:validation.status,draft,briefing,illustrations:[],validation,receipt:null,prompt_sha256:hash(INSTRUCTIONS),parameters:{model:config.model,max_output_tokens:config.max_output_tokens,request_profile:config.request_profile}});
 }
 if(archive){verifyArchive(archive);writeFileSync(join(preview,'editions',archive.edition_id+'.json'),JSON.stringify(archive));
  report.openai={status:reused?'reused_for_validation':'not_called_deterministic_preview',calls:0};report.validation=archive.validation;
  report.consultation={status:'local_preview_ready',url:`/journal/preview?date=${date}&id=${archive.edition_id}`,archive_id:archive.edition_id,preview_mode:archive.mode,compatible_ai_url:reused?`https://agriclimax.vercel.app/journal?id=${reused.edition_id}`:null,environment:{AGRICLIMAX_AI_PREVIEW_ARCHIVE_DIR:preview,AGRICLIMAX_MANUAL_RUN_DIR:root}};
 }
 report.preview=report.consultation;
 if(options.mode==='dry-run')return;
 if(decision==='preserve_published'){
  const published=before.publications.find(p=>p.edition_date===date)!;
  report.publication={status:'already_published',archive_id:published.archive_id};
  report.consultation={status:'retained_archive',url:`https://agriclimax.vercel.app/journal?date=${date}&id=${published.archive_id}`};
  return;
 }
 phase="production_resume";
 if(control.emergency_stop){report.blockers=['EMERGENCY_STOP'];return;}
 if(existing&&existing.id!==snapshot.id){report.blockers=['TEST_SNAPSHOT_DIFFERS_FROM_FROZEN_PRODUCTION','Use the isolated preview; validated production inputs cannot be replaced.'];return;}
 if(decision==='insufficient_data'||decision==='compatible_generation_preserved'){report.blockers=[decision];return;}
 if(!existing){
  phase='production_freeze';
  // This branch is unreachable in dry-run and never replaces an existing freeze.
  if(Date.parse(snapshot.frozen_at)<Date.parse(snapshot.cutoff_at))throw Error('FREEZE_BEFORE_CUTOFF');
  if(options.force_ai_regeneration)throw Error('PRODUCTION_SNAPSHOT_REQUIRED_FOR_REGENERATION');
  if(!capturedInputs)throw Error('CAPTURED_INPUTS_REQUIRED');
  const candidate=productionSnapshot(snapshot,await archiveInputs(capturedInputs));
  await editorialRPC('freeze',{edition_date:date,snapshot:candidate,snapshot_json:JSON.stringify(candidate)});
  const frozen=await editorialRPC<DailyEditorialSnapshot|null>('snapshot_read',{edition_date:date});
  if(!frozen)throw Error('SNAPSHOT_READBACK_MISSING');verifySnapshot(frozen);
  report.snapshot={id:frozen.id,quality:frozen.quality,status:'production_frozen',test_id:snapshot.id};
  if(frozen.id!==candidate.id){report.blockers=['CONCURRENT_SNAPSHOT_PRESERVED'];return;}
  snapshot=frozen;
 }
 if(decision==='resume_missing_generation') {
  const args=['--recover'];if(options.force_ai_regeneration)args.push('--authorize-snapshot',options.authorized_snapshot);
  const receipt=run('run',args);report.resume=receipt;
  // Actual paid calls are determined below from persistent receipts, never guessed from runner success.
  if(receipt.exit_code!==0)report.blockers=[typeof receipt.receipt?.error==='string'?receipt.receipt.error:'RESUME_FAILED_CHECK_PERSISTENT_DIAGNOSTICS'];
 }
 const after=await editorialRPC<{runs:Run[];diagnostics:{kind?:string;run_id?:string}[]}>("report",{edition_date:date});
 const beforeIds=new Set(before.runs.map(r=>r.id));const newIds=new Set(after.runs.filter(r=>!beforeIds.has(r.id)).map(r=>r.id));
 report.openai={status:newIds.size?'persistent_attempt_checked':compatible?'reused_compatible_response':'preserved',calls:after.diagnostics.filter(d=>d.kind==='provider_request'&&d.run_id&&newIds.has(d.run_id)).length};
 const persisted=await editorialRPC<DailyEditorialSnapshot|null>('snapshot_read',{edition_date:date});
 if(persisted){verifySnapshot(persisted);report.snapshot={id:persisted.id,quality:persisted.quality,status:'production_frozen',test_id:snapshot.id};}
 if((report.blockers as unknown[]).length)return;
 let production=existing?originals.find(a=>a.briefing.bundle_id===existing.briefing?.bundle_id&&validateDraft(a.draft,a.briefing,a.illustrations).status!=='rejected'):undefined;
 if(!production)for(const r of after.runs.filter(r=>r.edition_date===date)){const a=await store.read(r.archive_id??r.id);if(a&&validateDraft(a.draft,a.briefing,a.illustrations).status!=='rejected'){production=a;break;}}
 if(production)report.validation=production.validation;
 if(options.mode==='resume')report.publication={status:before.publications.some(p=>p.edition_date===date)?'already_published':'not_requested_resume'};
 if(options.mode==='publish') {
  phase='publication';
  if(!production){report.publication={status:'refused',reason:'VALIDATED_ARCHIVE_REQUIRED'};return;}
  const receipt=run('run');
  if(receipt.exit_code!==0)throw Error('EXPERIMENTAL_PUBLICATION_FAILED');
  report.publication={status:'experimental_consultable',archive_id:production.edition_id};
 }
 phase='consultation';report.service_check=run('report');
 if((report.service_check as {exit_code:number}).exit_code!==0)report.blockers=['CONSULTATION_NOT_VERIFIED'];
 report.consultation={status:(report.service_check as {exit_code:number}).exit_code===0?'verified':'not_verified',url:production?`https://agriclimax.vercel.app/journal?date=${date}&id=${production.edition_id}`:null};
}
export const execution=main().catch(error=>{report.blockers=[error instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(error.message)?error.message:'MANUAL_EXECUTION_FAILED'];report.status='failed';if(error instanceof BriefingContractError)report.contract_diagnostics=error.diagnostics;process.exitCode=1;}).finally(()=>{
 report.phase=phase;report.finished_at=new Date().toISOString();report.status??=(report.blockers as unknown[]).length?'blocked':'completed';save('report.json',report);
 const cell=(v:unknown)=>JSON.stringify(v??null).replace(/\|/g,'\\|').replace(/[\r\n]/g,' ');
 const summary='## AgriclimaX — exécution manuelle\n\n| Contrôle | Résultat |\n|---|---|\n'+Object.entries({Édition:report.edition_date,Mode:report.mode,Acquisitions:report.acquisitions,Fraîcheur:report.freshness,Couverture:report.coverage,Indicateurs:report.indicators,Snapshot:report.snapshot,OpenAI:report.openai,Validation:report.validation,Reprise:report.resume,Publication:report.publication,Consultation:report.consultation,Preview:report.preview,Blocages:report.blockers}).map(([k,v])=>`| ${k} | ${cell(v)} |`).join('\n')+'\n';writeFileSync(join(root,'summary.md'),summary);if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
 console.log(JSON.stringify({output:root,status:report.status,edition_date:report.edition_date,mode:report.mode,openai:report.openai,blockers:report.blockers}));
});
