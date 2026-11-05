// Real cycle only; no mocked route, time, source or response.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=process.env.TASK26_BASE_URL||'http://127.0.0.1:3026';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const output=process.env.TASK26_ARTIFACTS||'docs/codex/task26/operational-local';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium'});
const report={base,mocked:false,realDataVerified:false,checks:[],viewports:[],errors:[]};
try{
 const page=await browser.newPage({locale:'fr-FR',reducedMotion:'reduce'});
 page.on('pageerror',e=>report.errors.push(e.message));
 assert.equal((await page.request.get(base+'/api/operational')).status(),400);
 const response=await page.request.get(base+'/api/operational?experimental=weather');
 assert.equal(response.status(),200,'Actual validated cycle required');
 const cycle=await response.json();assert.equal(cycle.rows.length,420);assert.equal(cycle.pra_count,12);
 const dates=[...new Set(cycle.rows.map(r=>r.valid_date))].sort();assert.equal(dates.length,7);
 assert.equal(new Set(cycle.rows.map(r=>r.pra_id)).size,12);
 assert.ok(cycle.rows.every(r=>r.nature==='forecast'&&Date.parse(r.model_run_at)===Date.parse(cycle.run)));
 report.run=cycle.run;report.dates=dates;report.pra=12;
 const fmt=v=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(v);
 // Representative points computed inside the unchanged official PRA polygons.
 const points={'pra:28341':[1.5309604452926004,48.12072168328314],'pra:29102':[-4.463692370502372,48.25476836579469],'pra:2B260':[9.164094653276404,42.2995954675024]};
 async function hoverValue(pra,row){
  const map=page.locator('.national-map');await map.scrollIntoViewIfNeeded();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const box=await map.boundingBox();const merc=([lon,lat])=>[(lon+180)/360,(1-Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))/Math.PI)/2];
  const a=merc([-5.3,41.3]),b=merc([9.8,51.2]),point=merc(points[pra]);
  const scale=Math.min((box.width-40)/(b[0]-a[0]),(box.height-40)/(a[1]-b[1]));
  const x=box.x+box.width/2+(point[0]-(a[0]+b[0])/2)*scale,y=box.y+box.height/2+(point[1]-(a[1]+b[1])/2)*scale;
  await page.mouse.move(x-0.3,y);await page.mouse.move(x,y);
  await page.locator('.national-hover').filter({hasText:pra.slice(4)}).waitFor({timeout:5000});
  const hover=await page.locator('.national-hover').innerText();
  assert.ok(hover.includes(row.value===null?'Indisponible':fmt(row.value)),`${pra}/${row.variable} API/map numeric parity: ${hover}`);
 }

 for(const [name,width,height] of [['desktop',1440,1000],['tablet',768,1000],['mobile',390,844]]){
  await page.setViewportSize({width,height});await page.goto(base+'/?experimental=weather');
  await page.locator('.national-map[data-ready="true"][data-feature-count="12"]').waitFor({timeout:90000});
  assert.match(await page.locator('main').innerText(),/Estimation J−1 : indisponible/);
  await page.evaluate(()=>{window.__task26bCanvas=document.querySelector('.national-map');});
  for(const date of [dates[0],dates.at(-1)]){
   await page.getByRole('combobox',{name:/^Date · UTC/}).selectOption(date);
   for(const pra of ['pra:28341','pra:29102','pra:2B260']){
    await page.getByRole('combobox',{name:/^PRA/}).selectOption(pra);
    for(const variable of ['temperature','precipitation','humidity','temperature_min','temperature_max']){
     await page.getByRole('combobox',{name:/^Variable/}).selectOption(variable);
     const row=cycle.rows.find(r=>r.valid_date===date&&r.pra_id===pra&&r.variable===variable);
     const text=await page.getByTestId('weather-value').innerText();
     assert.ok(text.includes(row.value===null?'Indisponible':fmt(row.value)),`${name}/${date}/${pra}/${variable} numeric parity`);
     await hoverValue(pra,row);
    }
   }
  }
  assert.equal(await page.evaluate(()=>window.__task26bCanvas===document.querySelector('.national-map')),true,'Canvas survives date/variable/PRA changes');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name} overflow`);
  await page.screenshot({path:`${output}/${name}.png`,fullPage:true});
  report.viewports.push({name,width,height,numericComparisons:30});
 }
 assert.deepEqual(report.errors,[]);report.realDataVerified=true;report.checks=['420 actual forecast rows','12 official PRA only','J+1 and J+7','NULL preserved','90 API/map/card numeric comparisons','Same canvas','No horizontal overflow','J−1 explicitly unavailable','No opt-in: HTTP400'];
 await writeFile(`${output}/browser-real.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
