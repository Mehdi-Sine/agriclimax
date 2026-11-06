// API equality against the already acquired, independently verified immutable PRA archive.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {unpackWeatherArchive} from '../../apps/web/lib/server/weather-archive-codec.ts';
const base=process.env.TASK26_BASE_URL||'http://127.0.0.1:3056';assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const d=unpackWeatherArchive(await readFile('work/task26c/national-actual.compact.json.gz'),'62ab191f162a076003ffba79994858fcef0692b3e1f52e1abef1652f2d3c6066');
const vars=['temperature','temperature_min','temperature_max','precipitation','humidity'],source={arome:'meteofrance-arome',arpege:'meteofrance-arpege',ifs:'ecmwf-open-data'};
let comparisons=0,maxResponseBytes=0;
for(const model of ['selected','arome','arpege','ifs']){
 const expected=model==='selected'?d.selected_indices.map(i=>d.rows[i]):d.rows.filter(r=>r.source_id===source[model]);
 for(const date of [...new Set(expected.map(r=>r.valid_date))].sort())for(const variable of vars){
  const response=await fetch(base+'/api/operational?'+new URLSearchParams({experimental:'weather',model,date,variable}));assert.equal(response.status,200);const text=await response.text();maxResponseBytes=Math.max(maxResponseBytes,Buffer.byteLength(text));const data=JSON.parse(text);
  assert.deepEqual(data.rows,expected.filter(r=>r.valid_date===date&&r.variable===variable));comparisons+=data.rows.length;
 }
}
const out=process.env.TASK26_ARTIFACTS||'docs/codex/task26/national-local';await mkdir(out,{recursive:true});const result={base,archiveSha256:'62ab191f162a076003ffba79994858fcef0692b3e1f52e1abef1652f2d3c6066',comparisons,exactRowEquality:true,maxResponseBytes,sourceRequests:0,storageWrites:0};await writeFile(out+'/api-exact.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
