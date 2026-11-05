// Real DEV/Preview only: no routes, fixtures or source-data interception.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=process.env.TASK26_BASE_URL||'http://127.0.0.1:3026';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Use local build or TLS-validating read-only Preview gateway');
const destination=process.env.TASK26_ARTIFACTS||'docs/codex/task26/local';
await mkdir(`${destination}/screenshots`,{recursive:true});
const report={base,mocked:false,realDataVerified:false,viewports:[],errors:[],timings:{},checks:[]};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'fr-FR',reducedMotion:'reduce'});
 page.on('pageerror',e=>report.errors.push(e.message));
 const started=performance.now();
 const response=await page.request.get(`${base}/api/national?action=availability`);
 assert.equal(response.status(),200,'Real catalog required');
 const catalog=await response.json();
 assert.equal(catalog.source_id,'era5-land');assert.equal(catalog.days.at(-1),catalog.latest);
 assert.ok(catalog.acquired_at);assert.ok(catalog.updated_at);
 report.catalog=catalog;report.timings.catalogMs=performance.now()-started;
 const dayStart=performance.now();
 const climateResponse=await page.request.get(`${base}/api/unified?${new URLSearchParams({start:catalog.latest,end:catalog.latest,indicator:'temperature'})}`);
 assert.equal(climateResponse.status(),200);const climate=await climateResponse.json();
 assert.equal(climate.data.length,713);assert.equal(new Set(climate.data.map(r=>r.territoryId)).size,713);
 report.timings.mapApiMs=performance.now()-dayStart;
 assert.equal(climate.data.find(r=>r.territoryId==='pra:06245').status,'partial');
 assert.equal(climate.data.find(r=>r.territoryId==='pra:29102').status,'unavailable');
 report.states=Object.fromEntries(['available','partial','unavailable'].map(s=>[s,climate.data.filter(r=>r.status===s).length]));
 for(const row of climate.data)if(row.status!=='available')assert.equal(row.anomaly,null,'No incomplete-series anomaly');
 const fmt=n=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(n);
 const complete=climate.data.find(r=>r.territoryId==='pra:28341');assert.ok(complete);
 const first=performance.now();
 for(const [size,width,height] of [['desktop',1440,1000],['tablet',768,1000],['mobile',390,844]]){
  await page.setViewportSize({width,height});
  for(const [space,path] of [['climat','/'],['productions','/productions?agri_production=rpg-group-1'],['analyse','/analyse']]){
   const url=new URL(path,base);url.searchParams.set('pra','pra:28341');url.searchParams.set('date',catalog.latest);url.searchParams.set('start',catalog.latest);url.searchParams.set('periode','jour');
   if(space==='productions')url.searchParams.set('territoire','pra:28341');
   await page.goto(url.href,{waitUntil:'domcontentloaded'});
   await page.locator('.national-map[data-ready="true"][data-feature-count="713"]').waitFor({timeout:90000});
   await page.getByText('date source :',{exact:false}).first().waitFor({timeout:60000});
   if(space!=='productions')await page.locator('.unified-source-state').filter({hasText:/PRA complètes/}).waitFor({timeout:90000});
   if(space==='climat')assert.ok((await page.locator('.unified-panel .unified-value strong').innerText()).includes(fmt(complete.value)),'API/card numeric parity');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${space}/${size} overflow`);
   const screenshot=`screenshots/${space}-${size}.png`;await page.screenshot({path:`${destination}/${screenshot}`,fullPage:true});
   report.viewports.push({space,size,width,height,screenshot});
  }
 }
 report.timings.responsiveNineViewsMs=performance.now()-first;
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(`${base}/?pra=pra%3A28341`,{waitUntil:'domcontentloaded'});
 await page.locator('.unified-source-state').filter({hasText:/PRA complètes/}).waitFor({timeout:90000});
 for(const [label,days] of [['7 jours',7],['30 jours',30]]){
  await page.getByRole('button',{name:label,exact:true}).click();
  const expectedStart=new Date(Date.parse(catalog.latest)-(days-1)*86400000).toISOString().slice(0,10);
  await page.waitForURL(url=>url.searchParams.get('start')===expectedStart&&url.searchParams.get('date')===catalog.latest);
  await page.locator('.unified-source-state').filter({hasText:/PRA complètes/}).waitFor({timeout:120000});
  report.checks.push(`${label}: calendar window ending on actually acquired date`);
 }
 // Same map element through all three spaces (app router navigation).
 await page.evaluate(()=>{window.__task26Map=document.querySelector('.national-map');});
 for(const label of ['Productions agricoles','Analyse agroclimato','Climat']){
  await page.getByRole('link',{name:label,exact:true}).click();
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>window.__task26Map===document.querySelector('.national-map')),true,'Same canvas across spaces');
 }
 report.checks.push('Shared map canvas retained across spaces');
 for(const path of ['/stations?mode=live_meteofrance&production=wheat','/stations?mode=live_meteofrance&production=cattle&indicator=thi'])assert.equal((await page.goto(base+path)).status(),200);
 report.checks.push('Historical station wheat/THI paths remain available');
 assert.deepEqual(report.errors,[]);report.realDataVerified=true;
 await writeFile(`${destination}/browser-real.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await browser.close();}
