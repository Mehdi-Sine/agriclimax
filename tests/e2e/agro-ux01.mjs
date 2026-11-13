// Real archive-only integration. Never calls a generator or modifies production.
import assert from 'node:assert/strict';
import {chromium} from './node_modules/playwright/index.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.AGRO_UX_ORIGIN??'http://127.0.0.1:3000';
const root=process.env.AGRO_UX_RUN??'work/agro-ux-01/local-run';
const out=process.env.AGRO_UX_OUTPUT??'docs/codex/AGRO-UX-01/evidence/browser';
const report=JSON.parse(await readFile(`${root}/report.json`,'utf8'));
assert.equal(report.openai.calls,0);assert.equal(report.publication.status,'not_requested');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH??'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
const results=[];
try{
for(const width of [1440,1280,768,390,360]){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(origin+report.preview.url,{waitUntil:'networkidle',timeout:60000});
 assert.equal(response.status(),200);
 await page.getByRole('heading',{name:'Cartes de l’exécution de test'}).waitFor();
 const section=page.getByRole('region',{name:'Cartes de l’exécution de test'});
 await section.scrollIntoViewIfNeeded();
 await section.locator('[data-ready=true]').waitFor({timeout:45000});
 const map=await page.request.get(origin+'/api/manual-journal?map='+await page.locator('#manual-map').inputValue());
 const data=await map.json();assert.equal(data.rows.length,713);assert.equal(new Set(data.rows.map(r=>r.territoryId)).size,713);
 const picker=page.getByLabel('PRA de test');assert.equal(await picker.locator('option').count(),714);
 await picker.focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.notEqual(await picker.inputValue(),'');
 const missing=data.rows.find(r=>r.value===null);
 if(missing){await picker.selectOption(missing.territoryId);await section.getByRole('status').filter({hasText:'indisponible'}).waitFor();}
 const available=data.rows.find(r=>r.value!==null);if(available){await picker.selectOption(available.territoryId);await section.getByRole('status').filter({hasText:available.territoryId}).waitFor();}
 if(width===1440){const catalogue=await (await page.request.get(origin+'/api/manual-journal')).json();const thi=catalogue.find(m=>m.indicator==='thi');assert.ok(thi);await page.locator('#manual-map').selectOption(thi.id);const thiData=await (await page.request.get(origin+'/api/manual-journal?map='+thi.id)).json();assert.ok(thiData.rows.every(r=>r.value===null));await section.getByText('0 PRA avec valeur renseignée sur leur support', {exact:false}).waitFor();await picker.selectOption(thiData.rows[0].territoryId);await section.getByRole('status').filter({hasText:'indisponible'}).waitFor();await page.locator('#manual-map').selectOption(data.id);await section.locator('[data-ready=true]').waitFor();}
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`preview overflow ${width}`);
 await picker.press('Escape');await picker.blur();
 await page.screenshot({path:`${out}/${width}-preview-map.png`,fullPage:false});
 await page.locator('h1').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${width}-preview.png`,fullPage:false});
 const production=await page.goto(origin+'/journal?date=2026-11-11',{waitUntil:'networkidle',timeout:60000});assert.equal(production.status(),200);
 await page.getByRole('heading',{level:1}).first().waitFor();
 assert.ok(await page.getByRole('navigation',{name:'Éditions archivées'}).getByRole('link').count());
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`journal overflow ${width}`);
 await page.screenshot({path:`${out}/${width}-journal.png`,fullPage:false});
 const boxes=await page.locator('.front-page > .hero-copy,.front-page > .empty-story').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};}));
 if(boxes.length===2)assert.ok(boxes[0].bottom<=boxes[1].top||boxes[1].right<=boxes[0].left||boxes[0].right<=boxes[1].left,'Title and map must not overlap');
 assert.deepEqual(errors,[]);results.push({width,preview:200,journal:200,rows:713,keyboard_picker:true,missing_tested:!!missing,overflow:false});
 await page.close();
}
const page=await browser.newPage();
for(const route of ['/','/climat','/productions','/veille','/analyse','/almanach','/cartes-du-jour','/aide-et-documentation','/aide-et-documentation/indicateurs','/journal?date=2000-01-01']){
 const response=await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:60000});assert.equal(response.status(),200,route);results.push({route,status:200});
 if(route==='/')assert.equal(new URL(page.url()).pathname,'/','UX-02B renders the Journal directly on the homepage');
 if(route.endsWith('/indicateurs'))assert.equal(await page.locator('main section').count(),14);
 if(route.includes('2000'))assert.ok((await page.locator('h1').textContent()).includes('Aucune édition'));
}
await page.close();
}finally{await browser.close();await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));}
console.log(JSON.stringify(results));
