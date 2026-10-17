import assert from 'node:assert/strict';
import {previewHeaders} from './preview-access.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:3000';
const station=process.env.E2E_STATION||'29075001';
assert.match(station,/^\d{8}$/);
const dir=process.env.E2E_PERFORMANCE_ARTIFACTS||'work/task18/performance';
await mkdir(dir,{recursive:true});
const reports=[];
for(const production of ['wheat','cattle']) for(const [view,route] of [['map','/'],['diagnostic','/diagnostic'],['history','/history'],['watch','/watch']]) {
 for(let sample=1;sample<=3;sample++) {
  const start=performance.now();
  const url=`${base}${route}?mode=live_meteofrance&production=${production}&station=${station}`;
  const response=await fetch(url,{headers:previewHeaders(url),redirect:'manual'});
  const body=await response.text();
  assert.equal(response.status,200);
  assert.ok(body.includes('Source : Météo-France') && body.includes(station),'Performance requires a published station and real source');
  for(const unavailable of ['Publication quotidienne indisponible','Station inconnue','Le service de données']) assert.ok(!body.includes(unavailable),'Performance requires readable real data');
  const normalized=body.replaceAll('\\"','"').replaceAll('&quot;','"');
  for(const field of ['"payload"','"provenance"','"parameters"','"results"','"night_recovery"','"series"']) assert.ok(!normalized.includes(field),view+field);
  for(const key of ['SUPABASE_SECRET_KEY','METEOFRANCE_OBSERVATIONS_API_KEY','METEOFRANCE_CLIMATOLOGY_API_KEY','CDSAPI_KEY','GH_TOKEN','VERCEL_AUTOMATION_BYPASS_SECRET']) {
   const secret=process.env[key];if(secret && secret.length>8) assert.ok(!body.includes(secret),`private credential: ${key}`);
  }
  reports.push({production,view,sample,status:response.status,ms:Math.round(performance.now()-start),html_bytes:Buffer.byteLength(body),privacy:true});
 }
}
await writeFile(`${dir}/report.json`,JSON.stringify({base,station,read_only:true,samples:reports},null,2));
console.log('24 read-only HTTP measurements and HTML field/credential checks passed.');
