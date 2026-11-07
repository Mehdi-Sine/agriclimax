import {writeFile,mkdir} from 'node:fs/promises';
const base=process.env.TASK30_ORIGIN??'http://localhost:3000',output=process.env.TASK30_OUTPUT??'docs/codex/task30/evidence/local';
await mkdir(output,{recursive:true});
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname)&&!new URL(base).hostname.endsWith('.vercel.app'))throw new Error('Unsupported acceptance origin');
const headers=base.startsWith('https:')?{'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET}:{};
const report={origin:base,tested_commit:process.env.TASK30_COMMIT??null,checks:[],timings:[],cycles:[]};
const get=async path=>{const start=performance.now();const r=await fetch(base+path,{headers,redirect:'error',signal:AbortSignal.timeout(60000)}),text=await r.text();report.timings.push({path,status:r.status,ms:Math.round(performance.now()-start),bytes:Buffer.byteLength(text)});if(!r.ok)throw new Error(path+':'+r.status);return JSON.parse(text);};
const check=(name,ok,detail={})=>{report.checks.push({name,ok,...detail});if(!ok)throw new Error(name);};
try{
 const s=await get('/api/veille');await get('/api/veille');
 const conditional=await fetch(base+'/api/veille',{headers:{...headers,'If-None-Match':JSON.stringify(s.identity)},redirect:'error'});
 check('unchanged-cycle-conditional-response',conditional.status===304&&(await conditional.text())==='');
 report.cycles.push({run:s.run,identity:s.identity,coverage:s.coverage,compute_ms:s.compute_ms,events:s.events.map(({text,rule_version,provenance,quality_flags,...e})=>e)});
 for(const id of ['pra:28341','pra:06249','pra:29102',s.places.find(p=>p.region==='Corse').id]){
  const data=await get('/api/operational?experimental=weather&pra='+id);
  const rows=data.rows.filter(r=>r.valid_date>=s.period[0]&&r.valid_date<=s.period[1]);
  const facts=s.metrics.filter(m=>m.pra===id);
  for(const [phenomenon,variable,op] of [['heat','temperature_max',Math.max],['frost','temperature_min',Math.min],['rain','precipitation',Math.max]]){
   const v=rows.filter(r=>r.variable===variable),expected=v.length===7&&v.every(r=>r.status==='available'&&r.value!==null)?op(...v.map(r=>r.value)):null,actual=facts.find(m=>m.phenomenon===phenomenon).value;
   check(`${id}:${phenomenon}:independent-extreme`,expected===null?actual===null:Math.abs(actual-expected)<1e-8,{actual,expected});
  }
  const rain=rows.filter(r=>r.variable==='precipitation').sort((a,b)=>a.valid_date.localeCompare(b.valid_date));
  let length=0,longest=0,previous='';for(const r of rain){const origin=r.source_id+'/'+r.model_run_at;if(origin!==previous)length=0;length=r.value!==null&&r.value<1?length+1:0;previous=origin;longest=Math.max(longest,length);}
  const dry=facts.find(m=>m.phenomenon==='dry');check(`${id}:dry:independent-sequence`,dry.value===longest,{actual:dry.value,expected:longest});
 }
 const old=await get('/api/veille?run=2026-11-06');report.cycles.push({run:old.run,identity:old.identity,coverage:old.coverage,compute_ms:old.compute_ms});
 check('new-cycle-changes-identity-and-period',old.identity!==s.identity&&old.period[0]!==s.period[0]);
 const h=await get('/api/veille/historique');let n=0;for(const r of h.rows){if(r.current_status==='available'&&r.current_coverage>=.9999&&r.sample_years===30&&r.reference_coverage===1&&r.anomaly!==null){check('historical-arithmetic:'+r.pra_id+':'+r.variable,Math.abs(r.anomaly-(r.current_value-r.normal_1991_2020))<1e-4);n++;}}
 report.historical={date:h.date,identity:h.identity,validated_rows:n,unavailable_rows:h.rows.length-n,crozon:h.rows.filter(r=>r.pra_id==='pra:29102')};
}catch(e){report.failure=e.message;process.exitCode=1;}
await writeFile(output+'/api-report.json',JSON.stringify(report,null,2));
