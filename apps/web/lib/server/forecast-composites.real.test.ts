import {expect,it,vi,afterEach} from 'vitest';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
vi.mock('server-only',()=>({}));
vi.mock('./weather-archives',()=>({forecastMaskObject:async(path:string)=>readFileSync(resolve(process.env.COUV05_REAL_SIDECARS!,path))}));
import {unpackWeatherArchive} from './weather-archive-codec';
import {forecastRecipeMasks} from './forecast-composites';
import {calculateQualified,type QualifiedDay} from '../../features/climate-quality/calculate';
import {calculate} from '../../features/agroclimatic/calculate';
import {AGRO03_RECIPES as RECIPES} from '../../features/multiproduction/agro03';
import {coveragePaint} from '../../features/cartography/coverage';
import {thumbnailSvg} from './map-thumbnail';
import type {WeatherRow} from '../../features/operational/model';
import type {EditionMap} from '../../features/edition-maps/model';
const archive=process.env.COUV05_REAL_ARCHIVE,root=process.env.COUV05_REAL_SIDECARS;
afterEach(()=>vi.unstubAllEnvs());
it.skipIf(!archive||!root)('replays 28 existing recipes on 713 PRA for each native model without changing values',async()=>{
  const raw=readFileSync(archive!),sha=createHash('sha256').update(raw).digest('hex');
  const all=unpackWeatherArchive(raw,sha).rows as WeatherRow[];
  const summaries=[];let total=0,qualified=0;
  vi.stubEnv('COUV05_RENDER_ENABLED','true');vi.stubEnv('COUV05_INDEX_SHA256','df8d1c4abc3a3427cee3df3daf200dc7058f408fa22be274bff84e476fbd9145');
  const began=performance.now();
  for(const model of ['arome-0p025','arpege-0p1','ifs-oper-0p25'])for(const recipe of RECIPES){
    const day='2026-11-15',rule=recipe.kernel;
    const rows=all.filter(r=>r.model===model&&r.valid_date===day&&rule.variables.includes(r.variable));
    const spatial=await forecastRecipeMasks(rows,sha,rule,day,day,rule.threshold);
    const ids=[...new Set(rows.map(r=>r.pra_id))];expect(ids).toHaveLength(713);
    const inputs=new Map<string,WeatherRow[]>();for(const r of rows)inputs.set(r.pra_id,[...(inputs.get(r.pra_id)??[]),r]);
    const results=ids.map(pra=>{
      const rs=inputs.get(pra)!,first=rs[0];
      const input:QualifiedDay={pra,date:day,values:Object.fromEntries(rs.map(r=>[r.variable,r.value])),compatible:true,
        complete:rs.every(r=>r.value!==null&&r.temporal_coverage===1),source:first.source_id,run:first.model_run_at,
        nature:'forecast',freshness:first.data_freshness,provenance:rs.map(r=>r.provenance_sha256),quality_flags:rs.flatMap(r=>r.quality_flags),climate_support:spatial?.supports.get(pra)};
      const before=calculate(pra,[input],day,day,rule,rule.threshold),after=calculateQualified(pra,[input],day,day,rule,rule.threshold);
      if(after.quality?.indicator_eligible){expect(after.value??after.observed_value).toBe(before.value);qualified++;}
      if(!spatial?.supports.has(pra))expect(after.value??after.observed_value??null).toBeNull();
      total++;return after;
    });
    const paint:Record<string,number>={};
    for(const r of results){const target=coveragePaint({value:r.value??r.observed_value??null,quality:r.quality,field:'value',geometrySupportId:r.support_id??undefined}).target;paint[target]=(paint[target]??0)+1;}
    const map:EditionMap={id:'real-'+model+recipe.id,indicator:recipe.id,title:rule.label,nature:'forecast',period:[day,day],unit:rule.unit,
      sources:[rows[0].source_id],cycles:[rows[0].model_run_at!],input_sha256:sha,rows:results.map(r=>({...r,observed_value:r.observed_value??null}))};
    if(process.env.COUV05C_VISUAL_DIR&&model==='arpege-0p1'&&['rain','temperature_mean','thi'].includes(recipe.id)){
      mkdirSync(process.env.COUV05C_VISUAL_DIR,{recursive:true});
      writeFileSync(resolve(process.env.COUV05C_VISUAL_DIR,recipe.id+'.json'),JSON.stringify({map,collection:spatial?.collection}));
    }
    const svg=thumbnailSvg(map,{exhaustive:true,coveredSupport:spatial?.collection});
    expect((svg.match(/data-pra-outline="true"/g)??[])).toHaveLength(713);
    expect(ids.filter(id=>/^pra:2[AB]/.test(id))).toHaveLength(6);
    summaries.push({model,indicator:recipe.id,pra:713,qualified:results.filter(r=>r.quality?.indicator_eligible).length,paint,rejections:spatial?.rejected});
  }
  if(process.env.COUV05C_REPORT)writeFileSync(process.env.COUV05C_REPORT,JSON.stringify({archive_sha256:sha,total,qualified,summaries,seconds:(performance.now()-began)/1000,max_rss_kib:process.resourceUsage().maxRSS,remote_writes:0,numeric_values_changed:0,contours_per_map:713},null,2));
},300000);
it.skipIf(!archive||!root)('qualifies a seven-day multivariable window on identical cells and keeps changing supports unknown',async()=>{
  const raw=readFileSync(archive!),sha=createHash('sha256').update(raw).digest('hex');
  const all=unpackWeatherArchive(raw,sha).rows as WeatherRow[],rule=RECIPES.find(r=>r.id==='thi')!.kernel;
  const start='2026-11-15',end='2026-11-21',rows=all.filter(r=>r.model==='ifs-oper-0p25'&&r.valid_date>=start&&r.valid_date<=end&&rule.variables.includes(r.variable));
  vi.stubEnv('COUV05_RENDER_ENABLED','true');vi.stubEnv('COUV05_INDEX_SHA256','df8d1c4abc3a3427cee3df3daf200dc7058f408fa22be274bff84e476fbd9145');
  const spatial=await forecastRecipeMasks(rows,sha,rule,start,end,rule.threshold);
  expect(spatial!.supports.size).toBeGreaterThan(0);expect(spatial!.supports.size).toBeLessThan(713);
  const pra=[...spatial!.supports.keys()][0],support=spatial!.supports.get(pra)!;
  const own=rows.filter(r=>r.pra_id===pra),dates=[...new Set(own.map(r=>r.valid_date))];
  const inputs:QualifiedDay[]=dates.map(date=>{const rs=own.filter(r=>r.valid_date===date),r=rs[0];return {pra,date,
    values:Object.fromEntries(rs.map(r=>[r.variable,r.value])),compatible:true,complete:true,source:r.source_id,run:r.model_run_at,nature:r.nature,
    freshness:r.data_freshness,provenance:rs.map(r=>r.provenance_sha256),quality_flags:[],climate_support:support};});
  const result=calculateQualified(pra,inputs,start,end,rule,rule.threshold);
  expect(result.quality?.indicator_eligible).toBe(true);expect(result.value).toBe(calculate(pra,inputs,start,end,rule,rule.threshold).value);
  if(process.env.COUV05C_REPORT){const report=JSON.parse(readFileSync(process.env.COUV05C_REPORT,'utf8'));report.seven_day_thi={model:'ifs',start,end,qualified_supports:spatial!.supports.size,rejected:spatial!.rejected,one_value_compared_exactly:true};writeFileSync(process.env.COUV05C_REPORT,JSON.stringify(report,null,2));}
},60000);
