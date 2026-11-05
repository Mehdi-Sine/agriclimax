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
 assert.ok(cycle.rows.every(r=>r.nature==='forecast'&&r.model_run_at===cycle.run));
 report.run=cycle.run;report.dates=dates;report.pra=12;
 const fmt=v=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(v);
 for(const [name,width,height] of [['desktop',1440,1000],['tablet',768,1000],['mobile',390,844]]){
  await page.setViewportSize({width,height});await page.goto(base+'/?experimental=weather');
  await page.locator('.national-map[data-ready="true"][data-feature-count="12"]').waitFor({timeout:90000});
  assert.match(await page.locator('main').innerText(),/Estimation J−1 : indisponible/);
  await page.evaluate(()=>{window.__task26bCanvas=document.querySelector('.national-map');});
  for(const date of [dates[0],dates.at(-1)]){
   await page.getByLabel('Date · UTC',{exact:true}).selectOption(date);
   for(const pra of ['pra:28341','pra:29102','pra:2B260']){
    await page.getByLabel('PRA',{exact:true}).selectOption(pra);
    for(const variable of ['temperature','precipitation','humidity','temperature_min','temperature_max']){
     await page.getByLabel('Variable',{exact:true}).selectOption(variable);
     const row=cycle.rows.find(r=>r.valid_date===date&&r.pra_id===pra&&r.variable===variable);
     const text=await page.getByTestId('weather-value').innerText();
     assert.ok(text.includes(row.value===null?'Indisponible':fmt(row.value)),`${name}/${date}/${pra}/${variable} numeric parity`);
    }
   }
  }
  assert.equal(await page.evaluate(()=>window.__task26bCanvas===document.querySelector('.national-map')),true,'Canvas survives date/variable/PRA changes');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name} overflow`);
  await page.screenshot({path:`${output}/${name}.png`,fullPage:true});
  report.viewports.push({name,width,height,numericComparisons:30});
 }
 assert.deepEqual(report.errors,[]);report.realDataVerified=true;report.checks=['420 actual forecast rows','12 official PRA only','J+1 and J+7','NULL preserved','90 API/card numeric comparisons','Same canvas','No horizontal overflow','J−1 explicitly unavailable','No opt-in: HTTP400'];
 await writeFile(`${output}/browser-real.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
