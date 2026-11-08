import {it,expect,vi} from 'vitest';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
vi.mock('server-only',()=>({}));
import {wheatHistory} from './wheat';
import {packHistoryProduct,unpackHistoryProduct,type JsonValue} from './history-product';
import {agroclimaticData} from './agroclimatic';
import {climateHistoryWindow} from './climate-history';
import {calendarDays} from '../../features/national/daily-availability';

it.skipIf(process.env.DATA01_REAL!=='1')('DATA-01 real recovered history through existing wheat calculators',async()=>{
 const output='../../docs/codex/DATA-01/evidence';await mkdir(output,{recursive:true});
 const cases=[];const began=performance.now();let compressedProduct:unknown;
 for(const length of [1,7,14,30]){
  const end=new Date(Date.parse('2026-10-01')+(length-1)*86400000).toISOString().slice(0,10);
  const dates=calendarDays('2026-10-01',end),t=performance.now();
  const input=await climateHistoryWindow(dates);
  expect(input.series).toBe('legacy-rpc-1');expect(input.rows).toHaveLength(length*713);
  const batch=await wheatHistory(['2026-10-01',end]);
  const original:Record<string,Record<string,number|null>[]>={};
  for(const date of dates){
   const raw=JSON.parse(gunzipSync(await readFile(`${output}/legacy/${date}.json.gz`)).toString()) as {rows:({id:string}&Record<string,number|null>)[]};
   for(const row of raw.rows)(original[row.id]??=[]).push(row);
  }
  const measured=[];
  for(const [id,rows] of Object.entries(batch.results)){
   expect(rows).toHaveLength(713);
   expect(rows.filter(r=>r.quality?.state==='native_complete')).toHaveLength(645);
   for(const r of rows){
    if(r.value===null)continue;
    const values=original[r.territoryId];const threshold=r.parameters.threshold??0;
    let expected:number;
    if(id==='rain')expected=values.reduce((n,v)=>n+v.precipitation!,0);
    else if(id==='temperature_mean')expected=values.reduce((n,v)=>n+v.temperature!,0)/length;
    else if(id==='gdd')expected=values.reduce((n,v)=>n+Math.max(0,v.temperature!-threshold),0);
    else {
     const field=id.startsWith('hot')?'temperature_max':id.startsWith('frost')?'temperature_min':'precipitation';
     const matches=values.map(v=>id.startsWith('hot')||id==='heavy_rain'?v[field]!>threshold:v[field]!<threshold);
     if(id.endsWith('sequence')){let run=0;expected=0;for(const yes of matches){run=yes?run+1:0;expected=Math.max(expected,run);}}
     else expected=matches.filter(Boolean).length;
    }
    expect(r.value).toBeCloseTo(expected,9);
    expect(r.provenance.length).toBeGreaterThan(0);
   }
   measured.push({id,complete:rows.filter(r=>r.value!==null).length,observed_partial:rows.filter(r=>r.quality?.state==='observed_partial').length});
  }
  if(length===30){
   const encoded=packHistoryProduct(JSON.parse(JSON.stringify(batch)) as JsonValue);
   expect(unpackHistoryProduct(encoded)).toEqual(batch);
   const raw=gzipSync(JSON.stringify(encoded),{level:6});
   await writeFile(`${output}/wheat-30d.json.gz`,raw);
   compressedProduct={bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex'),format:'climate-history-product-1; lossless dictionary + gzip',nodes:encoded.nodes.length,json_bytes:Buffer.byteLength(JSON.stringify(encoded))};
  }
  const replayStart=performance.now();expect(await wheatHistory(['2026-10-01',end])).toBe(batch);
  const replay_ms=performance.now()-replayStart;
  cases.push({replay_ms,length,period:['2026-10-01',end],series:input.series,version:input.version,elapsed_ms:performance.now()-t,result_bytes:Buffer.byteLength(JSON.stringify(batch)),indicators:measured});
 }
 const modern=await climateHistoryWindow(calendarDays('2026-10-19','2026-11-01'));expect(modern.series).toBe('exact-storage-1');expect(modern.rows).toHaveLength(14*713);
 const coastal=await wheatHistory(['2026-10-02','2026-10-08']);
 const coastalCounts=['temperature_mean','gdd','rain'].map(id=>({id,complete:coastal.results[id].filter(r=>r.quality?.state==='native_complete').length,partial:coastal.results[id].filter(r=>r.quality?.state==='observed_partial').length}));
 for(const c of coastalCounts){expect(c.complete).toBe(645);expect(c.partial).toBe(67);}
 const t=performance.now();
 const agro=await agroclimaticData(new URLSearchParams({indicator:'temperature_mean',start:'2026-10-01',end:'2026-10-30'}));
 expect(agro.data.filter(r=>r.quality?.state==='native_complete')).toHaveLength(645);
 const agroMetric={ms:performance.now()-t,bytes:Buffer.byteLength(JSON.stringify(agro)),complete:645};
 await writeFile(`${output}/calculators.json`,JSON.stringify({executed_at:new Date().toISOString(),cases,coastalCounts,compressedProduct,agro:agroMetric,total_ms:performance.now()-began,peak_rss_bytes:process.resourceUsage().maxRSS*1024,remote_writes:0,source_acquisitions:0},null,2));
},300000);
