// Real Journal/carrousel/cards/thumbnail routes against an isolated local candidate.
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const origin=process.env.COUV06_ORIGIN??'http://127.0.0.1:3016',label=process.env.COUV06_LABEL??'after';
const root=`work/couv06/edition-${label}`,output='docs/codex/COUV-06/evidence/browser';
const edition=JSON.parse(await readFile(`${root}/consultable-edition.json`));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE??'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
const report={label,checks:[],errors:[],thumbnails:[]};
try{
 for(const width of [1440,768,390]){
  const page=await browser.newPage({viewport:{width,height:1000},locale:'fr-FR'});
  page.on('pageerror',e=>report.errors.push(e.message));
  const result=await page.request.get(`${origin}/api/journal/maps?id=${edition.edition_id}`);
  assert.equal(result.status(),200);
  const view=await result.json();assert.equal(view.status,'preview');
  const historical=view.maps.filter(m=>m.nature==='reanalysis');assert.equal(historical.length,5);
  for(const info of historical){
   if(width!==1440&&info.indicator!=='temperature_mean')continue;
   const url=`${origin}/cartes-du-jour?id=${edition.edition_id}&map=${info.id}`;
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:180000});
   const map=page.locator('.national-map[data-ready="true"]');await map.waitFor({timeout:180000});
   const state=await map.evaluate(e=>({...e.dataset}));
   assert.equal(state.renderedContourCount,'713');
   assert.equal(state.coverageEnabled,label==='after'?'true':'false');
   if(label==='after'){assert.equal(state.wholeCount,'681');assert.equal(state.coveredCount,'31');assert.equal(state.unavailableCount,'1');}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await page.locator('.journal-pra-map').screenshot({path:`${output}/${label}-edition-${width}-${info.indicator}.png`});
   report.checks.push({width,indicator:info.indicator,url,state});
   if(width===1440){
    const thumb=await page.request.get(`${origin}/api/journal/thumbnail?id=${edition.edition_id}&map=${info.id}&v=ux03-1`);
    assert.equal(thumb.status(),200);assert.equal(thumb.headers()['content-type'],'image/webp');assert.equal(thumb.headers()['cache-control'],'no-store');
    const bytes=await thumb.body();await writeFile(`${output}/${label}-thumbnail-${info.indicator}.webp`,bytes);
    report.thumbnails.push({indicator:info.indicator,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
   }
  }
  await page.goto(`${origin}/journal?id=${edition.edition_id}`,{waitUntil:'domcontentloaded',timeout:180000});
  const carousel=page.locator('.journal-map-carousel');
  // Keep the actual Journal's selected cards and its actual outgoing links.
  const cards=page.locator('.journal-map-card');await cards.first().waitFor({timeout:180000});
  assert.equal(await cards.count(),edition.map_selection.map_ids.length);
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.journal-thumbnail img')).every(i=>i.complete&&i.naturalWidth>0),{timeout:180000});
  await carousel.screenshot({path:`${output}/${label}-journal-${width}.png`});
  const first=cards.first().locator('a').first(),href=await first.getAttribute('href');
  await first.click();await page.locator('.national-map[data-ready="true"]').waitFor({timeout:180000});
  assert.ok(page.url().includes(href));
  report.checks.push({width,flow:'journal-carousel-to-interactive',cards:await page.locator('.national-map').getAttribute('data-rendered-contour-count'),href});
  void carousel;
  await page.close();
 }
 assert.deepEqual(report.errors,[]);
}finally{await browser.close();await writeFile(`${output}/${label}-editions.json`,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({label,checks:report.checks.length,thumbnails:report.thumbnails.length,errors:report.errors}));
