// Read-only acceptance against actual published data; no mocked route or source.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=process.env.TASK26_BASE_URL||'http://127.0.0.1:3056';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const out=process.env.TASK26_ARTIFACTS||'docs/codex/task26/national-local';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium'});
const report={base,mocked:false,checks:[],viewports:[],errors:[],apiComparisons:0};
try{
const page=await browser.newPage({locale:'fr-FR',reducedMotion:'reduce'});page.on('pageerror',e=>report.errors.push(e.message));
async function get(query){const response=await page.request.get(base+'/api/operational?experimental=weather&'+query,{timeout:90000});assert.equal(response.status(),200);return response.json();}
const cat=await get('catalogue=1');assert.equal(cat.pra_count,713);assert.equal(cat.pra_ids.length,713);assert.equal(cat.all_dates.length,9);assert.equal(cat.rows.length,0);report.run=cat.run;
const variables=['temperature','temperature_min','temperature_max','precipitation','humidity'];
for(const model of ['selected','arome','arpege','ifs']){
 const catalogue=await get('catalogue=1&model='+model);
 for(const date of catalogue.available_dates)for(const variable of variables){const d=await get(new URLSearchParams({model,date,variable}));assert.equal(d.rows.length,713);assert.equal(new Set(d.rows.map(r=>r.pra_id)).size,713);assert.ok(d.rows.every(r=>r.variable===variable&&r.valid_date===date&&r.nature==='forecast'));report.apiComparisons+=713;}
}
async function choose(name,value,param){await page.getByRole('combobox',{name,exact:true}).selectOption(value);await page.waitForURL(u=>u.searchParams.get(param)===value);}
const fmt=v=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(v);
for(const [name,width,height] of [['desktop',1440,1000],['tablet',768,1000],['mobile',390,844]]){
 await page.setViewportSize({width,height});await page.goto(base+'/?experimental=weather');await page.locator('.national-map[data-ready="true"][data-feature-count="713"]').waitFor({timeout:90000});
 for(const [model,date,pra] of [['selected',cat.all_dates[0],'pra:29102'],['arome',cat.all_dates[2],'pra:2B260'],['arpege',cat.all_dates[4],'pra:50081'],['ifs',cat.all_dates.at(-1),'pra:28341']]){
  await choose('Modèle',model,'weather_model');await choose('Date · UTC',date,'weather_date');await choose('PRA',pra,'pra');
  for(const variable of variables){await choose('Variable',variable,'weather_variable');console.log(name,model,date,pra,variable);const data=await get(new URLSearchParams({model,date,variable}));const row=data.rows.find(r=>r.pra_id===pra);assert.ok(row);await page.waitForFunction(({expected})=>document.querySelector('[data-testid="weather-value"]')?.textContent.includes(expected),{expected:row.value===null?'Indisponible':fmt(row.value)},{timeout:30000});}
 }
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,name+' horizontal overflow');await page.screenshot({path:`${out}/${name}.png`,fullPage:true});report.viewports.push({name,width,height,cardComparisons:20});
}
assert.deepEqual(report.errors,[]);report.checks=['713 official features','all source dates and five variables','forecast nature retained','60 real API/card comparisons','three responsive widths','no horizontal overflow'];await writeFile(`${out}/browser-real.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
