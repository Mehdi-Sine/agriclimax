/** COUV-05D: real retained native common inputs, no production flag or network. */
import {expect,it} from 'vitest';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {AGRO03_RECIPES} from '../../features/multiproduction/agro03';
import {calculateQualified,type QualifiedDay} from '../../features/climate-quality/calculate';
import {calculate} from '../../features/agroclimatic/calculate';
import {coveragePaint} from '../../features/cartography/coverage';
import type {WeatherVariable} from '../../features/operational/model';
type RecordInput={archive_sha256:string;model:string;run:string;start:string;end:string;indicator:string;pra_id:string;rule:unknown;support_id:string;fraction:number;native_cells:number;units:Partial<Record<WeatherVariable,string>>;days:{date:string;values:Partial<Record<WeatherVariable,number|null>>;source_sha256:string;source:string;nature:string;freshness:string;quality_flags:string[]}[]};
const root=process.env.COUV05D_NUMERIC_DIR??'../../docs/codex/COUV-05D/evidence';
it('qualifies exactly the 1185 residuals using unchanged formulae on common native cells',()=>{
  const began=performance.now(),packed=readFileSync(resolve(root!,'common-inputs.json.gz'));
  const records=JSON.parse(gunzipSync(packed).toString()) as RecordInput[];
  expect(records).toHaveLength(1185);
  const audit=JSON.parse(readFileSync(resolve(root,'native-audit.json'),'utf8'));
  expect(createHash('sha256').update(packed).digest('hex')).toBe(audit.inputs_sha256);
  const unique=new Set<string>(),counts:Record<string,number>={},results=[];
  for(const r of records){
    const recipe=AGRO03_RECIPES.find(k=>k.id===r.indicator)!;expect(recipe).toBeDefined();
    expect(r.rule).toEqual(recipe.kernel);expect(r.archive_sha256).toBe('ed93ab41472f81cec83a6039d8634133fa1feb42fe71d6513090d74d6985a398');
    const key=JSON.stringify([r.model,r.run,r.start,r.end,r.indicator,r.pra_id]);expect(unique.has(key)).toBe(false);unique.add(key);
    expect(r.native_cells).toBeGreaterThan(0);
    for(const v of recipe.kernel.variables)expect(r.units[v]).toBe(v==='precipitation'?'mm':v==='humidity'?'%':'degC');
    const inputs:QualifiedDay[]=r.days.map(d=>({pra:r.pra_id,date:d.date,values:d.values,
      compatible:true,complete:recipe.kernel.variables.every(v=>d.values[v]!==null&&Number.isFinite(d.values[v])),
      source:d.source,run:r.run,nature:d.nature,freshness:d.freshness,provenance:[d.source_sha256],quality_flags:[...d.quality_flags,'native_common_support_recalculation'],
      climate_support:{id:r.support_id,identity:r.support_id,fraction:r.fraction,temporal_complete:true,mask:'native_valid_cells',method:'couv05d-native-common-1'}}));
    const result=calculateQualified(r.pra_id,inputs,r.start,r.end,recipe.kernel,recipe.kernel.threshold);
    const baseline=calculate(r.pra_id,inputs,r.start,r.end,recipe.kernel,recipe.kernel.threshold);
    const eligible=!!result.quality?.indicator_eligible;
    expect(result.value??result.observed_value??null).toBe(eligible?baseline.value:null);
    expect(eligible).toBe(true);
    // Independent arithmetic check on the retained common daily inputs.
    const daily=r.days.map(d=>recipe.kernel.variables.includes('humidity')
      ? (1.8*d.values.temperature!+32)-(0.55-0.0055*d.values.humidity!)*(1.8*d.values.temperature!-26)
      : d.values.precipitation!);
    const operator=recipe.kernel.operator,threshold=recipe.kernel.threshold;
    const hits=daily.map(v=>threshold!==null&&(operator==='atLeast'||operator==='longestAtLeast'?v>=threshold:operator==='above'||operator==='longestAbove'||operator==='thiAbove'||operator==='thiLongest'?v>threshold:v<threshold));
    let longest=0,current=0;for(const hit of hits){current=hit?current+1:0;longest=Math.max(longest,current);}
    const expected=operator==='sum'?daily.reduce((a,b)=>a+b,0):operator==='max'||operator==='thi'?Math.max(...daily):operator.startsWith('longest')||operator==='thiLongest'?longest:hits.filter(Boolean).length;
    expect(result.value??result.observed_value).toBeCloseTo(expected,12);
    const reading={value:result.value??result.observed_value??null,quality:result.quality,field:'value' as const};
    expect(coveragePaint({...reading,geometrySupportId:r.support_id}).target).toBe(r.fraction>=.9?'whole':'covered');
    if(r.fraction<.9)expect(coveragePaint({...reading,geometrySupportId:'wrong-support'}).target).toBe('unavailable');
    const rejected=calculateQualified(r.pra_id,inputs.map((d,i)=>i===0?{...d,complete:false,values:{}}:d),r.start,r.end,recipe.kernel,recipe.kernel.threshold);
    expect(rejected.value??rejected.observed_value??null).toBeNull();
    counts[r.indicator]=(counts[r.indicator]??0)+Number(eligible);
    results.push({...r,days:undefined,result});
  }
  if(!process.env.COUV05D_NUMERIC_DIR)return;
  mkdirSync(root!,{recursive:true});
  const bytes=gzipSync(JSON.stringify(results));writeFileSync(resolve(root!,'qualified-residuals.json.gz'),bytes);
  writeFileSync(resolve(root!,'numeric-report.json'),JSON.stringify({examined:records.length,qualified:results.filter(r=>r.result.quality?.indicator_eligible).length,counts,
    previous_qualified:730387,total_qualified:730387+results.filter(r=>r.result.quality?.indicator_eligible).length,
    unchanged_partial_thi_null:26400,unchanged_absent_null:660,inputs_sha256:createHash('sha256').update(packed).digest('hex'),
    output_sha256:createHash('sha256').update(bytes).digest('hex'),output_bytes:bytes.length,seconds:(performance.now()-began)/1000,max_rss_kib:process.resourceUsage().maxRSS,
    supplier_requests:0,remote_writes:0,production_activation:false},null,2)+'\n');
},60000);
