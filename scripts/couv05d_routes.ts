/** Full HTTP routes; real archived inputs. No intercepted responses, mutations or AI. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {coveragePaint} from '../apps/web/features/cartography/coverage';
import type {CoverageQuality} from '../apps/web/features/climate-quality/policy';
import type {PraCollection} from '../apps/web/features/national/map';
import type {WeatherRow} from '../apps/web/features/operational/model';
import type {AgroPayload} from '../apps/web/lib/server/agroclimatic';
import {unpackWeatherArchive} from '../apps/web/lib/server/weather-archive-codec';
const base=process.env.COUV05D_BASE??'http://127.0.0.1:3015',out=process.env.COUV05D_ROUTES_DIR??'work/couv05d-routes';
const run=process.env.COUV05D_RUN??'2026-11-14T18:00:00+00:00',archive=process.env.COUV05D_ARCHIVE_SHA??'ed93ab41472f81cec83a6039d8634133fa1feb42fe71d6513090d74d6985a398';
const day=(lead:number)=>new Date(Date.parse(run)+(lead+1)*86400000).toISOString().slice(0,10);
const original=unpackWeatherArchive(readFileSync(`work/couv05d-store/${archive}.json.gz`),archive);
type RouteCheck={name:string;path:string;rows:number;corsica:number;paint:Record<string,number>;geometry_features:number;bytes:number;sha256:string;seconds:number};
const rows=original.rows as WeatherRow[],checks:RouteCheck[]=[];
const calls=[
 ['temperature','/api/operational?'+new URLSearchParams({experimental:'weather',run,model:'selected',date:day(0),variable:'temperature'})],
 ['partial-rain','/api/operational?'+new URLSearchParams({experimental:'weather',run,model:'ifs',date:day(Number(process.env.COUV05D_RAIN_LEAD??4)),variable:'precipitation'})],
 ['humidity','/api/operational?'+new URLSearchParams({experimental:'weather',run,model:'ifs',date:day(0),variable:'humidity'})],
 ['homogeneous-rain','/api/agroclimatic?'+new URLSearchParams({indicator:'rain',temporal:'forecast',run,start:day(1),end:day(2)})],
 ['homogeneous-thi','/api/agroclimatic?'+new URLSearchParams({indicator:'thi',temporal:'forecast',run,start:day(4),end:day(6)})],
];
async function main(){
 for(const [name,path] of calls){
  const began=performance.now(),response=await fetch(base+path);assert.equal(response.status,200);
  const raw=await response.text();
  const data=JSON.parse(raw) as {rows?:WeatherRow[];coverage_quality?:{definitions:Record<string,CoverageQuality>;lookup:Record<string,string>};forecast_support?:PraCollection}&AgroPayload;
  const paint={whole:0,covered:0,unavailable:0},ids=new Set<string>();
  const resultRows=data.rows??data.data;assert.equal(resultRows.length,713);
  for(const result of resultRows){
   const weather='pra_id' in result,pra=weather?result.pra_id:result.territoryId;ids.add(pra);
   const quality=weather?data.coverage_quality!.definitions[data.coverage_quality!.lookup[`${pra}/${result.valid_date}/${result.variable}`]]:result.quality;
   const feature=data.forecast_support?.features.find(f=>f.id===pra);
   const value=weather?result.value:result.value??result.observed_value??null;
   const p=coveragePaint({value,quality,field:'value',geometrySupportId:feature?.properties.support_id});paint[p.target]++;
   if(weather){const before=rows.find(r=>r.pra_id===pra&&r.model===result.model&&r.model_run_at===result.model_run_at&&r.valid_date===result.valid_date&&r.variable===result.variable);assert.deepEqual(result,before);}
   if(p.target==='covered'){assert.ok(feature);assert.equal(feature.properties.support_id,quality!.evidence.support_id);assert.ok(quality!.evidence.fraction!<.9);}
  }
  assert.equal([...ids].filter(id=>/^pra:2[AB]/.test(id)).length,6);
  checks.push({name,path,rows:713,corsica:6,paint,geometry_features:data.forecast_support?.features.length??0,bytes:Buffer.byteLength(raw),sha256:createHash('sha256').update(raw).digest('hex'),seconds:(performance.now()-began)/1000});
 }
 mkdirSync(out,{recursive:true});writeFileSync(out+'/routes.json',JSON.stringify({mode:process.env.COUV05D_MODE??'on',checks,mutations:0},null,2)+'\n');console.log(JSON.stringify(checks));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
