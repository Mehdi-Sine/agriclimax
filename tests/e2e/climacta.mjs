import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from './node_modules/playwright/index.mjs';

// Read-only verification of the actual OPS-06 edition; no fixture or generation.
const base=process.env.BASE_URL??'http://localhost:3000';
const reference=process.env.REFERENCE_URL;
const out=process.env.EVIDENCE_DIR??'work/climacta';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE??'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader'],...(process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY,bypass:'localhost,127.0.0.1'}}:{})});
const headers=process.env.VERCEL_AUTOMATION_BYPASS_SECRET?{'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET}:{};
const report={base,date:'2026-11-12',screens:[],maps:[],errors:[],generationRequests:0};
try {
 const context=await browser.newContext({extraHTTPHeaders:headers});
 const json=async(url)=>{
  // Playwright errors can include request headers; do not log credential values.
  let r;try{r=await context.request.get(url,{timeout:90000});}catch{throw Error(`GET failed: ${url}`);}
  assert.equal(r.status(),200,url);return r.json();
 };
 const edition=await json(`${base}/api/journal/edition?date=${report.date}`);
 assert.equal(edition.date,report.date);report.edition_id=edition.edition_id;report.edition_checksum=edition.checksum;
 const mapsUrl=`/api/journal/maps?id=${edition.edition_id}`;
 const view=await json(base+mapsUrl);assert.equal(view.status,'published');assert.equal(view.maps.length,10);
 assert.equal(view.maps.filter(m=>m.nature==='reanalysis').length,5);
 assert.equal(view.maps.filter(m=>m.nature==='forecast').length,5);
 report.bundle_sha256=view.bundle_sha256;
 if(reference){
  assert.deepEqual(edition,await json(`${reference}/api/journal/edition?date=${report.date}`));
  assert.deepEqual(view,await json(reference+mapsUrl));
 }
 for(const info of view.maps){
  const path=`${mapsUrl}&map=${info.id}`,data=await json(base+path);
  assert.equal(data.publication_state,'published');assert.equal(data.bundle_sha256,view.bundle_sha256);
  assert.equal(data.map.rows.length,713);assert.equal(new Set(data.map.rows.map(r=>r.territoryId)).size,713);
  if(reference)assert.deepEqual(data,await json(reference+path));
  report.maps.push({id:info.id,title:info.title,nature:info.nature,period:info.period,rows:713,identicalToProduction:!!reference});
 }
 for(const [label,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const page=await context.newPage();await page.setViewportSize({width,height});
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('request',r=>{if(/api\.openai\.com/.test(r.url()))report.generationRequests++;});
  const started=Date.now();
  // Direct entry without prefetch or a date query must resolve the latest edition.
  await page.goto(`${base}/journal`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.getByRole('heading',{name:edition.draft.headline.text,exact:true}).waitFor({timeout:90000});
  const articleMs=Date.now()-started;
  await page.getByRole('link',{name:'Climacta, retour au Journal',exact:true}).waitFor();
  assert.match(await page.title(),/Climacta/);
  assert.match(await page.locator('.ux01-edition-meta').innerText(),/12 NOVEMBRE 2026/);
  assert.equal(await page.getByText('Préparation de l’édition à partir des archives vérifiées…',{exact:true}).count(),0);
  assert.match(await page.locator('.freshness').innerText(),/ne constituent pas des constats de dommages agricoles/);
  await page.getByText('Réserves scientifiques de cette édition',{exact:true}).click();
  assert.match(await page.locator('.editorial-note').first().innerText(),/Consultable ne signifie pas scientifiquement validée ou approuvée/);
  await page.locator('.maplibregl-canvas').waitFor({timeout:90000});
  await page.waitForFunction(()=>!document.body.innerText.includes('Application des couleurs…'),{},{timeout:30000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`${out}/journal-${label}.png`,fullPage:true});
  await page.goto(`${base}/cartes-du-jour?date=${report.date}&id=${edition.edition_id}`,{waitUntil:'domcontentloaded',timeout:90000});
  const picker=page.getByRole('combobox',{name:'Indicateur de l’édition',exact:true});
  await picker.waitFor({timeout:90000});assert.equal(await picker.locator('option').count(),10);
  for(const info of view.maps){
   await picker.selectOption(info.id);
   await page.locator(`figure[data-map-id="${info.id}"] .maplibregl-canvas`).waitFor({timeout:90000});
   assert.match(await page.locator('figure').innerText(),/Les hachures signalent les supports partiels/);
   assert.deepEqual((await page.getByRole('alert').allTextContents()).map(t=>t.trim()).filter(Boolean),[]);
   const pra=page.getByRole('combobox',{name:'PRA de l’édition',exact:true});
   assert.equal(await pra.locator('option').count(),714);
  }
  await picker.selectOption(view.maps[0].id);
  await page.locator('.maplibregl-canvas').waitFor({timeout:90000});
  await page.waitForFunction(()=>!document.body.innerText.includes('Application des couleurs…'),{},{timeout:30000});
  await page.screenshot({path:`${out}/cartes-${label}.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  // A selected forecast deep link must keep its real period and ID after reload.
  const forecast=view.maps.find(m=>m.nature==='forecast');
  await page.goto(`${base}/cartes-du-jour?id=${edition.edition_id}&map=${forecast.id}`,{waitUntil:'domcontentloaded',timeout:90000});
  await picker.waitFor({timeout:90000});assert.equal(await picker.inputValue(),forecast.id);
  await page.goto(`${base}/journal?date=2000-01-01`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.getByRole('heading',{name:'Aucune édition archivée à cette date',exact:true}).waitFor({timeout:90000});
  report.screens.push({label,width,height,articleMs,directEntry:true,mapsOpened:10,overflow:false,forecastDeepLink:true,missingDate:true});
  await page.close();
 }
 assert.deepEqual(report.errors,[]);assert.equal(report.generationRequests,0);
} finally {await browser.close();await writeFile(`${out}/browser-report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
