// Actual product HTTP/API/MapLibre. No response interception or synthetic values.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.env.COUV06_ORIGIN??'http://127.0.0.1:3016';
const label=process.env.COUV06_LABEL??'after';
const output='docs/codex/COUV-06/evidence/browser';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE??'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
const report={origin,label,checks:[],errors:[]};
try{
 for(const width of [1440,768,390]){
  const page=await browser.newPage({viewport:{width,height:1000},locale:'fr-FR'});
  page.on('pageerror',e=>report.errors.push(e.message));
  for(const indicator of ['temperature','rain','temperature_min','temperature_max','thi']){
   if(width!==1440&&!['temperature','thi'].includes(indicator))continue;
   const agro=indicator==='thi';
   const query=agro?'production=cattle&agro=thi&temporal=history&agro_start=2026-11-01&agro_end=2026-11-01':'temporal=history&date=2026-11-01&start=2026-11-01&periode=jour&mode=value&indicateur='+indicator;
   const url=origin+(agro?'/analyse?':'/climat?')+query;
   const api=page.waitForResponse(r=>new URL(r.url()).pathname===(agro?'/api/agroclimatic':'/api/unified')&&r.ok(),{timeout:180000});
   const begun=performance.now();
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:180000});
   const response=await api,payload=await response.json();
   assert.equal(payload.data.length,713);
   const map=page.locator('.national-map[data-ready="true"]');
   await map.waitFor({timeout:180000});
   await page.locator('.map-updating').waitFor({state:'hidden',timeout:180000});
   const states=await map.evaluate(e=>({...e.dataset}));
   assert.equal(states.renderedContourCount,'713');
   assert.equal(states.coverageEnabled,label==='after'?'true':'false');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
   assert.equal(overflow,false);
   const regions=['pra:29102','pra:29101','pra:17111','pra:33115','pra:13469','pra:83469',...payload.data.filter(r=>r.territoryId.startsWith('pra:2A')||r.territoryId.startsWith('pra:2B')).map(r=>r.territoryId)];
   const regional=payload.data.filter(r=>regions.includes(r.territoryId)).map(r=>({pra:r.territoryId,value:r.value,observed_value:r.observed_value,coverage:r.coverage??r.spatial_coverage,quality:r.quality}));
   await page.locator('.national-map-wrap').screenshot({path:`${output}/${label}-${width}-${indicator}.png`});
   report.checks.push({width,indicator,url,ms:Math.round(performance.now()-begun),states,overflow,regional});
   if(width===1440&&indicator==='temperature'){
    for(const pra of ['pra:29101','pra:17111','pra:13469','pra:2B258']){
     await page.goto(url+'&pra='+encodeURIComponent(pra),{waitUntil:'domcontentloaded'});
     await page.locator('.national-map[data-ready="true"]').waitFor({timeout:180000});
     await page.getByRole('button',{name:'Voir ce territoire',exact:true}).click();
     await page.waitForTimeout(500);
     await page.locator('.national-map-wrap').screenshot({path:`${output}/${label}-${pra.replace(':','-')}.png`});
    }
   }
  }
  await page.close();
 }
 assert.deepEqual(report.errors,[]);
}finally{await browser.close();await writeFile(`${output}/${label}.json`,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({label,checks:report.checks.length,errors:report.errors}));
