// API-only active historical catalogue; values read from actual product services.
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.env.COUV06_ORIGIN??'http://127.0.0.1:3016';
const checks=[];
for(const days of [1,7,30]){
 const end='2026-11-01',start=new Date(Date.parse(end)-(days-1)*86400000).toISOString().slice(0,10);
 for(const id of ['gdd','hot','hot_sequence','frost','frost_sequence','rain','heavy_rain','dry','dry_sequence','thi','thi_days','thi_sequence','cattle_heat','temperature_mean']){
  const url=`${origin}/api/agroclimatic?`+new URLSearchParams({indicator:id,start,end,temporal:'history'});
  const begun=performance.now(),response=await fetch(url);assert.equal(response.status,200,`${id}/${days}`);
  const payload=await response.json();assert.equal(payload.data.length,713);
  const states={};for(const row of payload.data){const key=row.quality?.state??'unknown';states[key]=(states[key]??0)+1;}
  if(id.startsWith('thi'))assert.ok(payload.data.every(r=>r.value===null&&r.observed_value==null));
  checks.push({id,period:[start,end],days,states,ms:Math.round(performance.now()-begun)});
 }
}
await writeFile('docs/codex/COUV-06/evidence/active-catalogue.json',JSON.stringify({checks,openai_calls:0,remote_writes:0},null,2)+'\n');
console.log(JSON.stringify({checks:checks.length}));
