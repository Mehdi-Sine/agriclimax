/** Exhaustive offline numeric replay. No production flags, supplier or AI calls. */
import {expect,it,vi} from 'vitest';
import {readFileSync,writeFileSync,mkdirSync,createWriteStream} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createGzip} from 'node:zlib';
import {pipeline} from 'node:stream/promises';
import {once} from 'node:events';
vi.mock('server-only',()=>({}));
const io=vi.hoisted(()=>({requests:0,bytes:0}));
vi.mock('./weather-archives',()=>({forecastMaskObject:async(path:string)=>{const raw=readFileSync(resolve(process.env.COUV05_REAL_SIDECARS!,path));io.requests++;io.bytes+=raw.length;return raw;}}));
import {unpackWeatherArchive} from './weather-archive-codec';
import {forecastMasks} from './forecast-masks';
import {qualifyForecastRecipe} from './forecast-composites';
import {calculateQualified,type QualifiedDay} from '../../features/climate-quality/calculate';
import {calculate} from '../../features/agroclimatic/calculate';
import {AGRO03_RECIPES} from '../../features/multiproduction/agro03';
import {calendarDays} from '../../features/national/daily-availability';
import type {WeatherRow} from '../../features/operational/model';
const archive=process.env.COUV05_REAL_ARCHIVE,root=process.env.COUV05_REAL_SIDECARS,out=process.env.COUV05C_MATRIX_OUTPUT;
it.skipIf(!archive||!root||!out)('replays all 758632 source-cycle-window-recipe-PRA values on proven common cells',async()=>{
  const began=performance.now(),raw=readFileSync(archive!),sha=createHash('sha256').update(raw).digest('hex');
  const all=unpackWeatherArchive(raw,sha).rows as WeatherRow[],cycles=new Map<string,WeatherRow[]>();
  for(const r of all){const key=JSON.stringify([r.model,Date.parse(r.model_run_at!)]);const list=cycles.get(key)??[];list.push(r);cycles.set(key,list);}
  mkdirSync(out!,{recursive:true});
  const packed=createGzip(),completion=pipeline(packed,createWriteStream(resolve(out!,'numeric-matrix.csv.gz')));
  packed.write('model,run,start,end,indicator,pra_id,status,value,observed_value,fraction,reason\n');
  const counts:Record<string,number>={},reasons:Record<string,number>={};
  let windows=0,total=0,qualified=0;
  vi.stubEnv('COUV05_RENDER_ENABLED','true');vi.stubEnv('COUV05_INDEX_SHA256','df8d1c4abc3a3427cee3df3daf200dc7058f408fa22be274bff84e476fbd9145');
  try{
    for(const [,cycle] of [...cycles].sort()){
      const dates=[...new Set(cycle.map(r=>r.valid_date))].sort();
      for(let i=0;i<dates.length;i++)for(let j=i;j<dates.length;j++){
        const start=dates[i],end=dates[j],days=calendarDays(start,end);
        if(days.some(d=>!dates.includes(d)))continue;
        windows++;
        const window=cycle.filter(r=>days.includes(r.valid_date));
        const cached=new Map<string,{rows:WeatherRow[];spatial:NonNullable<Awaited<ReturnType<typeof forecastMasks>>>;inputs:Map<string,QualifiedDay[]>}>();
        for(const recipe of AGRO03_RECIPES){
          const rule=recipe.kernel,key=[...rule.variables].sort().join(',');let entry=cached.get(key);
          if(!entry){
            const rows=window.filter(r=>rule.variables.includes(r.variable)),spatial=await forecastMasks(rows,sha,{identicalMemberships:true});expect(spatial).toBeDefined();
            const grouped=new Map<string,Map<string,WeatherRow[]>>();
            for(const r of rows){const group=grouped.get(r.pra_id)??new Map<string,WeatherRow[]>();group.set(r.valid_date,[...(group.get(r.valid_date)??[]),r]);grouped.set(r.pra_id,group);}
            const inputs=new Map<string,QualifiedDay[]>();
            for(const [pra,group] of grouped)inputs.set(pra,[...group].map(([date,rs])=>({pra,date,values:Object.fromEntries(rs.map(r=>[r.variable,r.value])),
              compatible:new Set(rs.map(r=>`${r.source_id}/${r.model_run_at}`)).size===1,complete:rs.length===rule.variables.length&&rs.every(r=>r.value!==null&&r.temporal_coverage===1&&r.status!=='unavailable'),
              source:rs[0].source_id,run:rs[0].model_run_at,nature:'forecast',freshness:rs[0].data_freshness,
              provenance:rs.map(r=>r.provenance_sha256),quality_flags:rs.flatMap(r=>r.quality_flags)})));
            entry={rows,spatial:spatial!,inputs};cached.set(key,entry);
          }
          const supports=qualifyForecastRecipe(entry.rows,entry.spatial,rule,start,end,rule.threshold);
          if('membershipRejections' in entry.spatial)for(const pra of Object.keys(supports.rejected)){
            const reason=entry.spatial.membershipRejections?.[pra];if(reason)supports.rejected[pra]=reason;
          }
          if('reason' in entry.spatial&&entry.spatial.reason)for(const pra of Object.keys(supports.rejected))supports.rejected[pra]=entry.spatial.reason;
          expect(entry.inputs.size).toBe(713);
          const chunk:string[]=[];
          for(const [pra,input] of entry.inputs){
            const support=supports.supports.get(pra),prepared=input.map(r=>({...r,climate_support:support}));
            const result=calculateQualified(pra,prepared,start,end,rule,rule.threshold),eligible=!!result.quality?.indicator_eligible;
            if(eligible){expect(result.value??result.observed_value).toBe(calculate(pra,prepared,start,end,rule,rule.threshold).value);qualified++;}
            else expect(result.value??result.observed_value??null).toBeNull();
            const status=eligible?result.support_scope!:'unqualified',reason=eligible?'qualified':supports.rejected[pra]??result.quality?.reason??'unavailable';
            counts[status]=(counts[status]??0)+1;reasons[reason]=(reasons[reason]??0)+1;total++;
            chunk.push([cycle[0].model,cycle[0].model_run_at,start,end,recipe.id,pra,status,result.value??'',result.observed_value??'',support?.fraction??'',reason].join(','));
          }
          if(!packed.write(chunk.join('\n')+'\n'))await once(packed,'drain');
        }
        console.log(JSON.stringify({window:windows,model:cycle[0].model,start,end,total,qualified}));
      }
    }
    expect(total).toBe(758632);expect(windows).toBe(38);
    packed.end();await completion;
    const matrix=readFileSync(resolve(out!,'numeric-matrix.csv.gz')),matrixSha=createHash('sha256').update(matrix).digest('hex');
    writeFileSync(resolve(out!,'numeric-replay.json'),JSON.stringify({archive_sha256:sha,rows:total,windows,recipes:AGRO03_RECIPES.length,qualified,unqualified:total-qualified,counts,reasons,matrix_sha256:matrixSha,matrix_bytes:matrix.length,
      seconds:(performance.now()-began)/1000,max_rss_kib:process.resourceUsage().maxRSS,local_object_reads:io.requests,local_packed_bytes_read:io.bytes,
      numeric_values_changed:0,source_requests:0,remote_writes:0,activation:false,derived_columns_omitted:['support_id'],reconstruction:'qualifyForecastRecipe with exact retained archive/index, recipe kernel and threshold'},null,2));
  }finally{vi.unstubAllEnvs();}
},600000);
