// Synthetic API transport is confined to this test. No mocked screenshots are produced.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=process.env.TASK24_BASE_URL||'http://127.0.0.1:3020';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const reference=JSON.parse(readFileSync('config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json','utf8'));
const fixture=reference.features.map((f,i)=>({territoryId:`pra:${f.properties.code}`,value:f.properties.code==='29102'?null:12+i%5,normal:f.properties.code==='29102'?null:10,anomaly:f.properties.code==='29102'?null:2+i%5,coverage:f.properties.code==='29102'?0:1,observedDays:f.properties.code==='29102'?0:1,expectedDays:1,status:f.properties.code==='29102'?'unavailable':f.properties.code==='01451'?'partial':'available',dataScale:'pra',datasetVersion:'synthetic-test-only',freshness:'synthetic-test-only',rule_version:'synthetic-test-only',provenance:'synthetic-test-only',quality_flags:[]}));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox','--enable-unsafe-swiftshader']});
const report={syntheticTransport:true,cases:[],errors:[]};
try{
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce',locale:'fr-FR'});
page.on('pageerror',e=>report.errors.push(e.message));
await page.route('**/api/agroclimatic?**',route=>route.fulfill({json:{data:fixture.map(r=>({...r,parameters:{threshold:25},series:[],signals:[],episodes:0,longest:0,data_freshness:['synthetic-test-only'],provenance:['synthetic-test-only']})),source_version:'synthetic-test-only',calculated_at:'2026-10-18T00:00:00Z'}}));
await page.route('**/api/unified?**',route=>route.fulfill({json:{data:fixture}}));
await page.route('**/api/national?**',route=>new URL(route.request().url()).searchParams.get('action')==='availability'?route.fulfill({json:{latest:'2026-10-18',days:Array.from({length:30},(_,i)=>new Date(Date.UTC(2026,8,19+i)).toISOString().slice(0,10))}}):route.fulfill({json:{data:Array.from({length:30},(_,i)=>new Date(Date.UTC(2026,8,19+i)).toISOString().slice(0,10)).flatMap(date=>['temperature','temperature_min','temperature_max','precipitation'].map(variable=>({date,variable,current_value:12,normal_1991_2020:10,anomaly:2,current_status:'available'})))}}));
await page.goto(base+'/?date=2026-10-15');
await page.locator('.national-map[data-ready="true"]').waitFor({timeout:60000});
await page.getByText(/PRA complètes/).waitFor();
assert.equal(await page.getByText(/Carte indisponible/).count(),0);
const canvas=page.locator('.maplibregl-canvas');const original=await canvas.elementHandle();await canvas.scrollIntoViewIfNeeded();
const box=await canvas.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
await page.waitForURL(/pra=pra/);
const id=new URL(page.url()).searchParams.get('pra');const expected=fixture.find(f=>f.territoryId===id);assert.ok(expected);
await page.locator('.unified-value strong').filter({hasText:String(expected.value)}).waitFor();
assert.match(await page.locator('.national-hover').innerText(),new RegExp(String(expected.value)));
report.cases.push('Real polygon hover/click, quantitative tooltip and panel equality');
await page.getByRole('combobox',{name:'Lecture',exact:true}).selectOption('normal');
await page.locator('.unified-value strong').filter({hasText:'10'}).waitFor();
await page.getByRole('combobox',{name:'Lecture',exact:true}).selectOption('anomaly');
await page.locator('.unified-value strong').filter({hasText:String(expected.anomaly)}).waitFor();
assert.equal(await page.locator('.unified-chart svg').count(),1);report.cases.push('Normal, anomaly, daily history');
for(const [name,path] of [['Productions agricoles','productions'],['Analyse agroclimato','analyse'],['Climat','']]){
 await page.getByRole('link',{name,exact:true}).click();await page.waitForURL(url=>url.pathname==='/'+path);
 assert.equal(new URL(page.url()).searchParams.get('pra'),id);
 assert.equal(await original.evaluate(node=>node===document.querySelector('.maplibregl-canvas')),true,'Map must persist across spaces');
}
await page.goBack();await page.waitForURL('**/analyse?**');await page.reload();assert.equal(new URL(page.url()).searchParams.get('pra'),id);
report.cases.push('Three spaces preserve PRA and the same canvas; browser back and reload');
await page.getByRole('combobox',{name:'Indicateur',exact:true}).selectOption('rain');await page.getByRole('button',{name:'30 jours',exact:true}).click();
assert.equal(new URL(page.url()).searchParams.get('agro_start'),'2026-09-19');assert.equal(new URL(page.url()).searchParams.get('agro_end'),'2026-10-18');
report.cases.push('Wheat period and indicator controls');
await page.goto(base+'/?pra=pra%3A29102&date=2026-10-15');await page.getByRole('heading',{name:/CROZON/}).waitFor();await page.locator('.unified-value strong').filter({hasText:'Indisponible'}).waitFor();
report.cases.push('Unavailable PRA never displays zero');
await page.goto(base+'/?pra=pra%3A01451&date=2026-10-15');await page.getByText('Résultat partiel :',{exact:false}).waitFor();report.cases.push('Partial coverage warning');
for(const width of [1440,768,390]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement!==document.body));
report.cases.push('Desktop/tablet/mobile overflow and keyboard focus');assert.deepEqual(report.errors,[]);
writeFileSync('docs/codex/task24/browser-synthetic.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
