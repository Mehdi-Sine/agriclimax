import {describe,it,expect,vi,afterEach} from 'vitest';
vi.mock('server-only',()=>({}));
vi.mock('node:child_process',()=>({spawnSync:vi.fn(()=>({status:0}))}));
import {manualOptions,generationDecision} from './manual-policy';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sealArchive} from '../editorial-ai/archive';
import {freezeSnapshot} from './snapshot';
import simulated from '../../../../docs/codex/task35/evidence/simulated-edition.json';
import type {Archive} from '../editorial-ai/model';
const now='2026-11-11T10:00:00Z',sha='a'.repeat(64);
const state={snapshot_id:sha,compatible_ai:false,published:false,quality:'fallback_valid'};
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();process.exitCode=0;});
describe('OPS-04 admissions and cost policy',()=>{
 it('defaults to Paris date and a read-only run',()=>expect(manualOptions({},'2026-11-10T23:15:00Z')).toMatchObject({edition_date:'2026-11-11',mode:'dry-run',refresh_sources:false,reuse_ai:true,force_ai_regeneration:false}));
 it.each(['2026-02-30','2026-11-12','yesterday'])('rejects invalid/future date %s',edition_date=>expect(()=>manualOptions({edition_date},now)).toThrow('INVALID_EDITION_DATE'));
 it('never generates in dry-run, even without a saved response',()=>expect(generationDecision(manualOptions({},now),state)).toBe('deterministic_preview'));
 it('reuses compatible AI and preserves an already published edition',()=>{
  const o=manualOptions({mode:'resume'},now);expect(generationDecision(o,{...state,compatible_ai:true})).toBe('reuse');expect(generationDecision(o,{...state,published:true})).toBe('preserve_published');
 });
 it('allows only the missing generation on resume and stops insufficient data',()=>{
  const o=manualOptions({mode:'resume'},now);expect(generationDecision(o,state)).toBe('resume_missing_generation');expect(generationDecision(o,{...state,quality:'insufficient'})).toBe('insufficient_data');
 });
 it('requires explicit reason, exact snapshot and a non-dry mode for regeneration',()=>{
  expect(()=>manualOptions({force_ai_regeneration:'true'},now)).toThrow();
  const o=manualOptions({mode:'resume',force_ai_regeneration:'true',authorized_snapshot:sha,regeneration_reason:'Previously rejected response'},now);
  expect(()=>generationDecision(o,{...state,snapshot_id:'b'.repeat(64)})).toThrow('EXACT_SNAPSHOT_AUTHORIZATION_REQUIRED');
  expect(()=>manualOptions({...Object.fromEntries(Object.entries(o).map(([k,v])=>[k,String(v)])),mode:'dry-run'},now)).toThrow();
 });
 it('does not overwrite a valid generation when reuse is explicitly disabled',()=>expect(generationDecision(manualOptions({mode:'resume',reuse_ai:'false'},now),{...state,compatible_ai:true})).toBe('compatible_generation_preserved'));
});
describe('OPS-04 real CLI read-only boundary with a source-shaped stored archive',()=>{
 it.each([['dry-run',false,false],['resume',false,false],['publish',false,false],['publish',true,false],['resume',true,true]] as const)('preserves data and review gates in %s, publication enabled=%s',async(mode,publicationEnabled,emergencyStop)=>{
  vi.resetModules();
  const {checksum,...body}=simulated as unknown as Archive;void checksum;
  const a=sealArchive({...body,mode:'live',receipt:{model:body.parameters.model,response_id:'resp_synthetic_only',usage:null,cost_eur:null,duration_ms:0,pricing_version:'synthetic'}});
  const snapshot=freezeSnapshot(a.date,[],a.briefing,new Date().toISOString(),{policy_version:'synthetic',nature:'reanalysis',reference_date:a.date,age_days:1,complete_pra:713,total_pra:713,usable:true,freshness:'fresh'});
  const actions:string[]=[];const dir=mkdtempSync(join(tmpdir(),'ops04-readonly-'));
  vi.stubEnv('AGRICLIMAX_MANUAL_OUTPUT',dir);vi.stubEnv('MANUAL_EDITION_DATE',a.date);vi.stubEnv('MANUAL_MODE',mode);vi.stubEnv('MANUAL_RECOMPUTE_INDICATORS','false');vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://synthetic.invalid');vi.stubEnv('SUPABASE_SECRET_KEY','synthetic');
  vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{
   const {p_action}=JSON.parse(init.body);actions.push(p_action);
   if(p_action==='report')return Response.json({diagnostics:[],acquisitions:[{source:'stations',state:'retryable_failure'},{source:'forecast',state:'retryable_failure'}],runs:[{id:a.edition_id,archive_id:a.edition_id,edition_date:a.date,state:'completed'}],publications:[]});
   if(p_action==='control')return Response.json({emergency_stop:emergencyStop,publication_enabled:publicationEnabled});
   if(p_action==='reviews')return Response.json([]);
   if(p_action==='snapshot_read')return Response.json(JSON.stringify(snapshot));
   if(p_action==='archive_read')return Response.json(JSON.stringify(a));
   throw Error('UNEXPECTED_WRITE_OR_PROVIDER');
  }));
  try{
   const runner=await import('../../../../scripts/manual_journal');await runner.execution;
   const result=JSON.parse(readFileSync(join(dir,'report.json'),'utf8'));
   if(emergencyStop){expect(result.status).toBe('blocked');expect(result.blockers).toEqual(['EMERGENCY_STOP']);expect(result.openai.calls).toBe(0);return;}
   expect(result.status).toBe('completed');expect(result.openai.calls).toBe(0);expect(result.snapshot.status).toBe(mode==='dry-run'?'reused_frozen':'production_frozen');expect(result.publication.status).toBe(mode==='dry-run'?'not_requested':mode==='resume'?'not_requested_resume':'waiting');
   if(mode==='publish')expect(result.publication.reason).toBe(publicationEnabled?'EDITORIAL_APPROVAL_REQUIRED':'PUBLICATION_DISABLED');
   expect(result.openai.status).toMatch(/reused/);
   expect(new Set(actions)).toEqual(new Set(['report','control','snapshot_read','archive_read',...(publicationEnabled?['reviews']:[])]));
  }finally{rmSync(dir,{recursive:true,force:true});}
 },30000);
});
