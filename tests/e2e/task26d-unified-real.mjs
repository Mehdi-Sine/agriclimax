// Actual Preview/DEV only. No routing interception, fabricated weather, or changed clock.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {unpackWeatherArchive} from '../../apps/web/lib/server/weather-archive-codec.ts';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=process.env.TASK26_BASE_URL||'http://127.0.0.1:3031',out=process.env.TASK26_ARTIFACTS||'docs/codex/task26/task26d-preview';
assert.equal(new URL(base).hostname,'127.0.0.1');await mkdir(out,{recursive:true});
const archive=unpackWeatherArchive(await readFile('work/task26d/national-h06.compact.json.gz'),'42b602fdc03b29707d423328026f216354e985e70debbc3252796335c24be724');
const selected=archive.selected_indices.map(i=>archive.rows[i]);
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});
const report={base,mocks:false,viewports:[],errors:[],comparisons:0,checks:[]};
try{
const p=await b.newPage({locale:'fr-FR',reducedMotion:'reduce'});p.on('pageerror',e=>report.errors.push(e.message));
async function json(path){const r=await p.request.get(base+path,{timeout:90000});assert.equal(r.status(),200,path);return r.json();}
const availability=await json('/api/national?action=availability');assert.equal(availability.latest,'2026-10-31');
const support=await json('/api/national/support?date=2026-10-31&variable=temperature');assert.equal(support.collection.features.length,67);assert.equal(support.rows.filter(r=>r.coverage>=.9).length,36);assert.equal(support.rows.filter(r=>r.coverage===0).length,1);
const ids=['pra:29102','pra:50081','pra:2B260'];
const fmt=v=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(v);
async function mode(label){await p.getByRole('button',{name:label,exact:true}).click();await p.waitForFunction(label=>Array.from(document.querySelectorAll('.temporal-navigation button')).some(b=>b.textContent===label&&b.getAttribute('aria-pressed')==='true'),label);}
async function select(name,value,param){const toggle=p.locator('.filters-toggle');if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')==='false')await toggle.click();await p.getByRole('combobox',{name:name==='Date · UTC'?/^Date · UTC/:new RegExp('^'+name)}).selectOption(value);await p.waitForURL(u=>u.searchParams.get(param)===value);}
for(const [name,width,height] of [['desktop',1440,1000],['tablet',768,1000],['mobile',390,844]]){
 await p.setViewportSize({width,height});await p.goto(base+'/?pra=pra:50081');await p.locator('.national-map[data-ready="true"][data-feature-count="713"]').waitFor({timeout:90000});
 const canvas=await p.locator('.maplibregl-canvas').elementHandle();assert.equal(await p.getByLabel('Date · UTC',{exact:true}).inputValue(),'2026-10-31');
 await p.locator('.unified-source-state').filter({hasText:/PRA complètes/}).waitFor({timeout:90000});
 assert.match(await p.locator('.unified-panel').innerText(),/portion réellement renseignée/);
 await mode('Météo récente');assert.equal(await canvas.evaluate(n=>n===document.querySelector('.maplibregl-canvas')),true);
 await select('Date · UTC','2026-11-05','recent_date');
 for(const pra of ids){await select('PRA',pra,'pra');for(const variable of ['temperature','precipitation','humidity']){
  await select('Variable',variable,'weather_variable');const row=selected.find(r=>r.pra_id===pra&&r.variable===variable&&r.valid_date==='2026-11-05');
  await p.waitForFunction(t=>document.querySelector('[data-testid="weather-value"]')?.textContent.includes(t),row.value===null?'Indisponible':fmt(row.value));report.comparisons++;
 }}
 await mode('Prévisions');await p.getByRole('button',{name:'J+3',exact:true}).click();await p.waitForURL(u=>u.searchParams.get('forecast_date')==='2026-11-09');
 await p.getByRole('button',{name:'J+7',exact:true}).click();await p.waitForURL(u=>u.searchParams.get('forecast_date')==='2026-11-13');
 for(const variable of ['temperature','precipitation']){await select('Variable',variable,'weather_variable');const row=selected.find(r=>r.pra_id==='pra:2B260'&&r.variable===variable&&r.valid_date==='2026-11-13');await p.waitForFunction(t=>document.querySelector('[data-testid="weather-value"]')?.textContent.includes(t),row.value===null?'Indisponible':fmt(row.value));report.comparisons++;}
 assert.match(await p.locator('.unified-main').innerText(),/2026-11-06T00:00:00Z/);
 await p.getByRole('link',{name:'Analyse agroclimato',exact:true}).click();await p.waitForURL(u=>u.pathname==='/analyse');assert.equal(new URL(p.url()).searchParams.get('pra'),'pra:2B260');assert.equal(await canvas.evaluate(n=>n===document.querySelector('.maplibregl-canvas')),true);
 await mode('Historique climatique');await select('Lecture temporelle','jour','periode');await select('Aléa descriptif','rain','indicateur');
 await mode('Prévisions');await select('Modèle','arome','weather_model');await p.getByText('Aucune échéance de ce modèle pour cette journée.',{exact:false}).waitFor();assert.match(await p.getByTestId('weather-value').innerText(),/Indisponible/);
 assert.equal(await p.getByRole('combobox',{name:/^Date · UTC/}).inputValue(),'2026-11-13','Absent model horizon preserves the requested date visibly');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,name+' overflow');
 await p.locator('.national-map').scrollIntoViewIfNeeded();await p.locator('.national-map-wrap').screenshot({path:`${out}/${name}-map.png`});await p.screenshot({path:`${out}/${name}.png`,fullPage:true});report.viewports.push({name,width,height,sameCanvas:true});
}
const cold=await json('/api/national?action=context-day&date=2026-10-30&variable=temperature&storage=cold');const warm=await json('/api/national?action=context-day&date=2026-10-30&variable=temperature');assert.deepEqual(cold.data,warm.data);
const history=await json('/api/national?action=context-history&pra=pra:50081&end=2026-10-31');assert.equal(history.data.length,120);assert.ok(history.archived_days.includes('2026-10-31'));
assert.deepEqual(report.errors,[]);report.checks=['latest ERA31 direct normal UI','recent estimate without opt-in','J+3 and J+7','five source semantics/no forecast normals','PRA preserved Climat/Analyse','one canvas all modes','67 actual partial supports/36 qualified means/zero-cell Crozon','source horizon absent stays NULL','warm/cold exact parity','new archive-only history120 rows','three widths no overflow'];await writeFile(out+'/browser-real.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await b.close();}
