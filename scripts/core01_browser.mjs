// Read-only local browser checks using the real configured historical archives.
import { chromium } from '../tests/e2e/node_modules/playwright/index.mjs';
import {mkdir, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.env.CORE01_ORIGIN??'http://127.0.0.1:3000';
assert(['127.0.0.1','localhost'].includes(new URL(origin).hostname));
const output='docs/codex/CORE-01/evidence/browser';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={executed_at:new Date().toISOString(),origin,synthetic:false,checks:[],errors:[]};
try{
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  page.on('pageerror',e=>report.errors.push(e.message));
  for(const [kind,path] of [['climate','/'],['analysis','/analyse']])for(const [version,rule] of [['before','agroclimatic-1.2.0'],['after','agroclimatic-1.3.0']]){
   const params=new URLSearchParams({temporal:'history',date:'2026-11-01',start:'2026-11-01',periode:'jour',indicateur:'temperature',mode:'value',pra:'pra:50081',agro:'temperature_mean',agro_start:'2026-11-01',agro_end:'2026-11-01',rule_version:rule,storage:'cold'});
   await page.goto(origin+path+'?'+params,{waitUntil:'networkidle',timeout:90000});
   await page.locator('.national-map[data-ready="true"]').waitFor({timeout:60000});
   const map=page.locator('.national-map');
   assert.equal(await map.getAttribute('data-feature-count'),'713');
   const covered=Number(await map.getAttribute('data-covered-support-count'));
   if(version==='after'){assert.equal(covered,0,'official whole polygons in new quality presentation');assert.equal(await map.getAttribute('data-quantitative-count'),'712');assert.equal(await map.getAttribute('data-partial-value-count'),'67');}
   await map.scrollIntoViewIfNeeded();
   await page.screenshot({path:`${output}/${name}-${kind}-${version}.png`});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
   const body=await page.locator('body').innerText();
   if(version==='after')assert(/portion|support renseigné|support observé/.test(body));
   if(version==='after'&&kind==='climate'){await page.locator('.unified-chart circle').waitFor();assert.equal(await page.locator('.unified-chart circle').count(),1);await page.locator('.unified-chart').screenshot({path:`${output}/${name}-climate-after-series.png`});}
   report.checks.push({name,kind,version,geometries:713,covered_overlay:covered,no_overflow:true});
  }
  for(const pra of ['pra:29102','pra:13244','pra:2A258','pra:2B260','pra:28341','pra:05236']){
   const response=await page.request.get(origin+'/api/agroclimatic?'+new URLSearchParams({indicator:'temperature_mean',start:'2026-11-01',end:'2026-11-01',pra}));
   assert.equal(response.status(),200);const payload=await response.json();
   assert.equal(payload.data.length,713);const row=payload.data.find(r=>r.territoryId===pra);
   assert(row.quality);if(pra==='pra:29102'){assert.equal(row.value,null);assert.equal(row.observed_value,null);}
   report.checks.push({name,pra,value:row.value,observed:row.observed_value,quality:row.quality.state});
  }
  await page.goto(origin+'/journal',{waitUntil:'networkidle',timeout:90000});
  await page.screenshot({path:`${output}/${name}-journal.png`});
  const journalMap=page.locator('.journal-pra-map');await journalMap.scrollIntoViewIfNeeded();
  await journalMap.locator('.national-map[data-ready="true"]').waitFor({timeout:60000});
  assert.equal(await journalMap.locator('.national-map').getAttribute('data-feature-count'),'713');
  await page.getByRole('combobox',{name:'PRA du Journal'}).selectOption('pra:50081');
  await journalMap.locator('.pra-selection').waitFor();
  await journalMap.getByText('Qualité et provenance',{exact:true}).click();
  assert((await journalMap.innerText()).includes('Segment 1'));
  await page.screenshot({path:`${output}/${name}-journal-map.png`});
  report.checks.push({name,kind:'journal-map',geometries:713,segment_proofs:true});
  await page.goto(origin+'/veille?phenomene=heat&pra=pra%3A50081',{waitUntil:'networkidle',timeout:90000});
  await page.locator('.national-map[data-ready="true"]').waitFor({timeout:60000});
  assert.equal(await page.locator('.national-map').getAttribute('data-feature-count'),'713');
  await page.locator('.national-map').scrollIntoViewIfNeeded();
  await page.screenshot({path:`${output}/${name}-watch.png`});
  report.checks.push({name,kind:'watch-map',geometries:713});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  report.checks.push({name,kind:'journal',no_overflow:true});
  await page.close();
 }
 assert.equal(report.errors.length,0);
}catch(e){report.failure=e.stack;process.exitCode=1;}
finally{await writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close();}
